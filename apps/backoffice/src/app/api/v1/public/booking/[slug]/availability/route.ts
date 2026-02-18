import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { sha256Hex } from "@/lib/publicBooking/bookingKey";

// --- IMPORTANTE: Evita cacheo ---
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ slug: z.string().min(2).max(200) });

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  key: z.string().min(12).max(200),
});

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Range = { start: string; end: string }; // "09:00".."18:00"
type WorkingHours = Record<DayKey, Range[]>;

function originHost(req: Request): string | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const raw = origin ?? referer;
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

async function resolveTerreno(
  admin: ReturnType<typeof supabaseAdmin>,
  slug: string,
) {
  const { data, error } = await admin
    .from("terrenos")
    .select("id, booking_enabled")
    .eq("slug", slug)
    .single();
  if (error) throw new Error(error.message);

  if (!data?.booking_enabled) {
    const err = new Error("BOOKING_DISABLED");
    (err as any).code = "BOOKING_DISABLED";
    throw err;
  }

  return { terrenoId: data.id as string };
}

async function verifyOriginAllowed(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
  host: string | null,
) {
  if (!host) return;

  const { data, error } = await admin
    .from("terreno_embed_domains")
    .select("domain")
    .eq("terreno_id", terrenoId)
    .eq("enabled", true);

  if (error) throw new Error(error.message);

  const allowed = (data ?? []).some(
    (r: any) => String(r.domain).toLowerCase() === host.toLowerCase(),
  );
  if (!allowed) {
    const err = new Error("ORIGIN_NOT_ALLOWED");
    (err as any).code = "ORIGIN_NOT_ALLOWED";
    throw err;
  }
}

async function verifyBookingKey(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
  bookingKey: string,
) {
  const { data, error } = await admin
    .from("terreno_booking_keys")
    .select("booking_key_hash")
    .eq("terreno_id", terrenoId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.booking_key_hash) {
    const err = new Error("BOOKING_KEY_NOT_SET");
    (err as any).code = "BOOKING_KEY_NOT_SET";
    throw err;
  }

  const got = sha256Hex(bookingKey);
  if (got !== String((data as any).booking_key_hash)) {
    const err = new Error("BOOKING_UNAUTHORIZED");
    (err as any).code = "BOOKING_UNAUTHORIZED";
    throw err;
  }
}

// --- CORRECCIÓN: Detectar día en Chile, no en UTC ---
function dayKeyFromDate(date: string): DayKey {
  // Creamos la fecha y forzamos la zona horaria para saber qué día es AHÍ
  // Usamos el mediodía para evitar problemas de borde
  const d = new Date(`${date}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    weekday: "short",
  });
  const dayName = fmt.format(d).toLowerCase(); // "mon", "tue", ...

  const map: Record<string, DayKey> = {
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
    sun: "sun",
  };
  return map[dayName] ?? "mon";
}

function parseHHMM(s: string): { h: number; m: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid time '${s}'`);
  return { h: Number(m[1]), m: Number(m[2]) };
}

function minutes(h: number, m: number) {
  return h * 60 + m;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function naiveUtcIsoFromDateTime(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00.000Z`).toISOString();
}

// --- CORRECCIÓN: Calcular Offset de Chile dinámicamente ---
function getChileOffsetHours(date: string): number {
  // Tomamos una hora de referencia UTC (ej: 12:00)
  const d = new Date(`${date}T12:00:00.000Z`);

  // Preguntamos qué hora es en Chile cuando en UTC son las 12:00
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hour: "numeric",
    hourCycle: "h23",
  });

  const chileHour = parseInt(fmt.format(d)); // Ej: 8 o 9

  // La diferencia es el offset (Ej: 12 - 9 = 3 horas)
  let diff = 12 - chileHour;
  if (diff < 0) diff += 24; // Seguridad por si cruza el día (raro al mediodía)

  return diff;
}

async function getSettings(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
) {
  const { data, error } = await admin
    .from("terreno_booking_settings")
    .select("working_hours, slot_duration_minutes, buffer_minutes") // Traemos todo
    .eq("terreno_id", terrenoId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const workingHours = (data?.working_hours ?? {
    mon: [{ start: "09:00", end: "18:00" }],
    tue: [{ start: "09:00", end: "18:00" }],
    wed: [{ start: "09:00", end: "18:00" }],
    thu: [{ start: "09:00", end: "18:00" }],
    fri: [{ start: "09:00", end: "18:00" }],
    sat: [],
    sun: [],
  }) as WorkingHours;

  const durationMin = data?.slot_duration_minutes ?? 60;
  const bufferMin = data?.buffer_minutes ?? 0;

  return { workingHours, durationMin, bufferMin };
}

async function getTaken(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
  date: string,
) {
  // Buscamos ocupados en todo el día UTC (Cubre cualquier desfase horario)
  const from = new Date(`${date}T00:00:00.000Z`).toISOString();
  const to = new Date(`${date}T23:59:59.999Z`).toISOString();

  const { data, error } = await admin
    .from("appointments")
    .select("id, starts_at, ends_at, status")
    .eq("terreno_id", terrenoId)
    .eq("status", "scheduled")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    start: new Date(r.starts_at).getTime(),
    end: new Date(r.ends_at).getTime(),
  }));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;

    const url = new URL(req.url);
    const q = QuerySchema.parse({
      date: url.searchParams.get("date"),
      key: url.searchParams.get("key"),
    });

    const admin = supabaseAdmin();
    const { terrenoId } = await resolveTerreno(admin, slug);

    await verifyOriginAllowed(admin, terrenoId, originHost(req));
    await verifyBookingKey(admin, terrenoId, q.key);

    const { workingHours, durationMin, bufferMin } = await getSettings(
      admin,
      terrenoId,
    );
    const taken = await getTaken(admin, terrenoId, q.date);

    // 1. Detectar día correcto
    const dayKey = dayKeyFromDate(q.date);
    const ranges = workingHours[dayKey] ?? [];

    // 2. Calcular Offset dinámico para HOY (ej: 3 o 4 horas)
    const offsetHours = getChileOffsetHours(q.date);
    const offsetMinutes = offsetHours * 60;

    const slots: { startsAt: string; endsAt: string }[] = [];

    for (const r of ranges) {
      const s = parseHHMM(r.start);
      const e = parseHHMM(r.end);

      // 'cur' son minutos LOCALES (ej: 9:00 = 540)
      let cur = minutes(s.h, s.m);
      const endMin = minutes(e.h, e.m);

      while (cur + durationMin <= endMin) {
        // CORRECCIÓN: Convertir hora LOCAL a UTC sumando el offset
        const utcCur = cur + offsetMinutes;
        const utcEnd = utcCur + durationMin;

        // Formatear a UTC hh:mm
        const uSh = Math.floor(utcCur / 60);
        const uSm = utcCur % 60;
        const uEh = Math.floor(utcEnd / 60);
        const uEm = utcEnd % 60;

        // Generar ISO UTC real
        // Nota: Si uSh >= 24, Date() lo maneja, pero booking suele ser mismo día.
        const startsAtIso = naiveUtcIsoFromDateTime(
          q.date,
          `${pad2(uSh % 24)}:${pad2(uSm)}`,
        );
        const endsAtIso = naiveUtcIsoFromDateTime(
          q.date,
          `${pad2(uEh % 24)}:${pad2(uEm)}`,
        );

        const slotStart = new Date(startsAtIso).getTime();
        const slotEnd = new Date(endsAtIso).getTime();

        const blocked = taken.some((t) =>
          overlaps(
            slotStart,
            slotEnd,
            t.start - bufferMin * 60_000,
            t.end + bufferMin * 60_000,
          ),
        );

        if (!blocked) slots.push({ startsAt: startsAtIso, endsAt: endsAtIso });

        cur += durationMin;
      }
    }

    return NextResponse.json({
      date: q.date,
      timezone: "America/Santiago",
      slots,
    });
  } catch (e: any) {
    return jsonError(e);
  }
}

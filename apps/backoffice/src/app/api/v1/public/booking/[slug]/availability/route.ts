import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { sha256Hex } from "@/lib/publicBooking/bookingKey";

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

function dayKeyFromDate(date: string): DayKey {
  const d = new Date(`${date}T12:00:00.000Z`);
  const dow = d.getUTCDay(); // 0..6
  const map: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[dow] ?? "mon";
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

/**
 * Para poder avanzar sin librerías de TZ:
 * - Generamos instantes en UTC "naive" con date + HH:MM como si fuese UTC.
 * - Luego en UI se formatea a America/Santiago.
 *
 * ✅ Esto sirve para ver slots (y comparar ocupados) ya.
 * Luego lo mejoramos a TZ Chile exacto (DST) con una función de offset.
 */
function naiveUtcIsoFromDateTime(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00.000Z`).toISOString();
}

async function getSettings(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
) {
  // Lee solo lo que sabemos que existe hoy: working_hours
  const { data, error } = await admin
    .from("terreno_booking_settings")
    .select("working_hours")
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

  // Defaults (mientras conectamos columnas reales)
  const durationMin = 60;
  const bufferMin = 0;

  return { workingHours, durationMin, bufferMin };
}

async function getTaken(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
  date: string,
) {
  // bounds naive UTC del día
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
    const { slug } = ParamsSchema.parse(await ctx.params);

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

    const dayKey = dayKeyFromDate(q.date);
    const ranges = workingHours[dayKey] ?? [];

    const slots: { startsAt: string; endsAt: string }[] = [];

    for (const r of ranges) {
      const s = parseHHMM(r.start);
      const e = parseHHMM(r.end);

      let cur = minutes(s.h, s.m);
      const endMin = minutes(e.h, e.m);

      while (cur + durationMin <= endMin) {
        const sh = Math.floor(cur / 60);
        const sm = cur % 60;

        const ehTotal = cur + durationMin;
        const eh = Math.floor(ehTotal / 60);
        const em = ehTotal % 60;

        const startsAtIso = naiveUtcIsoFromDateTime(
          q.date,
          `${pad2(sh)}:${pad2(sm)}`,
        );
        const endsAtIso = naiveUtcIsoFromDateTime(
          q.date,
          `${pad2(eh)}:${pad2(em)}`,
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

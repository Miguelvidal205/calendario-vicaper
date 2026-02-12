import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { sha256Hex } from "@/lib/publicBooking/bookingKey";

const ParamsSchema = z.object({ slug: z.string().min(2).max(200) });

const BodySchema = z.object({
  bookingKey: z.string().min(12).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  visitorName: z.string().min(2).max(120),
  visitorEmail: z.string().email().max(200).optional().or(z.literal("")),
  visitorPhone: z.string().min(3).max(40).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Range = { start: string; end: string };
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

  // DEV shortcut: permite localhost para no bloquear pruebas
  if (process.env.NODE_ENV !== "production") {
    if (host.startsWith("localhost:") || host.startsWith("127.0.0.1:")) return;
  }

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

async function getSettings(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
) {
  // Usa solo working_hours (ya sabemos que existe en tu tabla)
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

  // Por ahora fijo (luego lo conectamos a columna real)
  const durationMin = 60;

  return { workingHours, durationMin };
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

function naiveUtcIsoFromDateTime(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00.000Z`).toISOString();
}

function isWithinWorkingHours(
  working: WorkingHours,
  date: string,
  time: string,
  durationMin: number,
) {
  const dayKey = dayKeyFromDate(date);
  const ranges = working[dayKey] ?? [];

  const t = parseHHMM(time);
  const startMin = minutes(t.h, t.m);
  const endMin = startMin + durationMin;

  return ranges.some((r) => {
    const rs = parseHHMM(r.start);
    const re = parseHHMM(r.end);
    const rStart = minutes(rs.h, rs.m);
    const rEnd = minutes(re.h, re.m);
    return startMin >= rStart && endMin <= rEnd;
  });
}

async function resolveAssignee(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
) {
  // MVP: asigna al primer admin/agent del terreno
  // Ajusta nombres de columnas si tu tabla difiere.
  const { data, error } = await admin
    .from("terreno_member")
    .select("user_id, role")
    .eq("terreno_id", terrenoId)
    .in("role", ["admin", "agent"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const first = (data ?? [])[0] as any;
  if (!first?.user_id) {
    const err = new Error("NO_ASSIGNEE_AVAILABLE");
    (err as any).code = "NO_ASSIGNEE_AVAILABLE";
    throw err;
  }
  return String(first.user_id);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = ParamsSchema.parse(await ctx.params);
    const body = BodySchema.parse(await req.json().catch(() => ({})));

    const admin = supabaseAdmin();
    const { terrenoId } = await resolveTerreno(admin, slug);

    await verifyOriginAllowed(admin, terrenoId, originHost(req));
    await verifyBookingKey(admin, terrenoId, body.bookingKey);

    const { workingHours, durationMin } = await getSettings(admin, terrenoId);

    if (
      !isWithinWorkingHours(workingHours, body.date, body.time, durationMin)
    ) {
      const err = new Error("OUTSIDE_WORKING_HOURS");
      (err as any).code = "OUTSIDE_WORKING_HOURS";
      throw err;
    }

    const assignedUserId = await resolveAssignee(admin, terrenoId);

    const startsAt = naiveUtcIsoFromDateTime(body.date, body.time);
    const startMs = new Date(startsAt).getTime();
    const endsAt = new Date(startMs + durationMin * 60_000).toISOString();

    // Guardamos datos de visitante en notes (MVP) para no depender de columnas nuevas
    const visitorBlock = `📌 Booking\n- Nombre: ${body.visitorName}\n- Email: ${body.visitorEmail || "-"}\n- Tel: ${
      body.visitorPhone || "-"
    }\n`;
    const combinedNotes =
      `${visitorBlock}${body.notes ? `\n📝 Notas:\n${body.notes}\n` : ""}`.trim();

    const { data, error } = await admin
      .from("appointments")
      .insert({
        terreno_id: terrenoId,
        assigned_user_id: assignedUserId,
        status: "scheduled",
        title: "Visita",
        notes: combinedNotes,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .select("id, starts_at, ends_at")
      .single();

    if (error) {
      // Si tu constraint anti-overlap dispara, supabase devuelve error -> lo convertimos a 409-friendly
      const msg = String(error.message || "");
      if (
        msg.toLowerCase().includes("overlap") ||
        msg.toLowerCase().includes("conflict")
      ) {
        const err = new Error("CONFLICT_OVERLAP");
        (err as any).code = "CONFLICT_OVERLAP";
        (err as any).status = 409;
        throw err;
      }
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      appointmentId: data.id,
      startsAt: new Date(data.starts_at).toISOString(),
      endsAt: new Date(data.ends_at).toISOString(),
      timezone: "America/Santiago",
    });
  } catch (e: any) {
    return jsonError(e);
  }
}

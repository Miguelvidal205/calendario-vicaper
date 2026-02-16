import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { sha256Hex } from "@/lib/publicBooking/bookingKey";
import { EVENT_TYPES } from "@vicaper/events";
import { DateUtils } from "@vicaper/contracts";

// --- Esquemas de Validación ---

const ParamsSchema = z.object({
  slug: z.string().min(2).max(200),
});

const BodySchema = z.object({
  bookingKey: z.string().min(12).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  visitorName: z.string().min(2).max(120),
  visitorEmail: z.string().email().max(200).optional().or(z.literal("")),
  visitorPhone: z.string().min(3).max(40).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

// --- Tipos Auxiliares ---

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Range = { start: string; end: string };
type WorkingHours = Record<DayKey, Range[]>;

// --- Funciones Auxiliares ---

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

  // DEV shortcut: permitir localhost en desarrollo
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
  // Comparación estricta del hash
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
  const { data, error } = await admin
    .from("terreno_booking_settings")
    .select("working_hours, slot_duration_minutes, mail_subject, mail_body")
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

  // Default a 60 min si no viene de la DB
  const durationMin = (data as any)?.slot_duration_minutes ?? 60;

  const mailConfig = {
    subject: data?.mail_subject || "Confirmación de Visita",
    body:
      data?.mail_body ||
      "Hola {{name}}, tu visita está confirmada para el {{date}} a las {{time}}.",
  };
  return { workingHours, durationMin, mailConfig };
}

function dayKeyFromDate(date: string): DayKey {
  // Asume formato YYYY-MM-DD para obtener el día de la semana
  const d = new Date(`${date}T12:00:00.000Z`);
  const dow = d.getUTCDay();
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

  // Verificar si el bloque de tiempo solicitado cae dentro de algún rango disponible
  return ranges.some((r) => {
    const rs = parseHHMM(r.start);
    const re = parseHHMM(r.end);
    const rStart = minutes(rs.h, rs.m);
    const rEnd = minutes(re.h, re.m);
    // Debe empezar después del inicio del rango y terminar antes del fin del rango
    return startMin >= rStart && endMin <= rEnd;
  });
}

async function resolveAssignee(
  admin: ReturnType<typeof supabaseAdmin>,
  terrenoId: string,
) {
  // Busca un usuario con rol admin o agent para asignar la cita
  const { data, error } = await admin
    .from("terreno_members")
    .select("user_id, role")
    .eq("terreno_id", terrenoId)
    .in("role", ["admin", "agent"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);

  const first = (data ?? [])[0] as any;
  if (!first?.user_id) {
    const err = new Error("NO_ASSIGNEE_AVAILABLE");
    (err as any).code = "NO_ASSIGNEE_AVAILABLE";
    throw err;
  }
  return String(first.user_id);
}

// --- Handler Principal POST ---

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = ParamsSchema.parse(await ctx.params);
    // Catch vacío para evitar error si el body está vacío o mal formado antes de validarlo con Zod
    const jsonBody = await req.json().catch(() => ({}));
    const body = BodySchema.parse(jsonBody);

    const admin = supabaseAdmin();

    // 1. Resolver Terreno y validar estado
    const { terrenoId } = await resolveTerreno(admin, slug);

    // 2. Validaciones de Seguridad (Origen y Key)
    await verifyOriginAllowed(admin, terrenoId, originHost(req));
    await verifyBookingKey(admin, terrenoId, body.bookingKey);

    // 3. Validar Horarios
    const { workingHours, durationMin, mailConfig } = await getSettings(
      admin,
      terrenoId,
    );

    // Nota: isWithinWorkingHours valida contra la configuración teórica (JSON),
    // no contra citas existentes (eso lo hace la constraint de DB o lógica adicional si se requiere).
    if (
      !isWithinWorkingHours(workingHours, body.date, body.time, durationMin)
    ) {
      const err = new Error("OUTSIDE_WORKING_HOURS");
      (err as any).code = "OUTSIDE_WORKING_HOURS";
      throw err;
    }

    // 4. Asignar Usuario
    const assignedUserId = await resolveAssignee(admin, terrenoId);

    // 5. Calcular Fechas UTC (Usando DateUtils para Timezone Chile)
    const startsAtDate = DateUtils.toUTC(body.date, body.time);
    const startsAt = startsAtDate.toISOString();

    const endsAtDate = new Date(startsAtDate.getTime() + durationMin * 60_000);
    const endsAt = endsAtDate.toISOString();

    // 6. Insertar Appointment
    const { data: appointment, error } = await admin
      .from("appointments")
      .insert({
        terreno_id: terrenoId,
        assigned_user_id: assignedUserId,
        status: "scheduled",
        title: "Visita",
        visitor_name: body.visitorName,
        visitor_email: body.visitorEmail || null,
        visitor_phone: body.visitorPhone || null,
        notes: body.notes || null,
        starts_at: startsAt,
        ends_at: endsAt,
        // origin_domain: originHost(req) || "unknown", // Descomentar si tienes esta columna
      })
      .select("id, starts_at, ends_at, terreno_id")
      .single();

    if (error) {
      const msg = String(error.message || "");
      // Manejo básico de conflictos si la DB tiene constraints de overlapping
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

    // 7. Insertar Evento en Outbox (Patrón Cron)
    if (appointment) {
      const payload = {
        appointmentId: appointment.id,
        terrenoId: appointment.terreno_id,
        visitor: {
          name: body.visitorName,
          email: body.visitorEmail || "",
          phone: body.visitorPhone || "",
        },
        schedule: {
          startsAt: appointment.starts_at,
          endsAt: appointment.ends_at,
          date: body.date,
          time: body.time,
        },
        metadata: {
          origin: req.headers.get("origin") || "unknown",
        },
        // === NUEVO: Pasamos la configuración del correo al worker ===
        emailTemplate: {
          subject: mailConfig.subject,
          body: mailConfig.body,
        },
      };

      const { error: outboxError } = await admin.from("event_outbox").insert({
        event_type: EVENT_TYPES.APPOINTMENT_CREATED,
        payload: payload,
        status: "pending",
        terreno_id: appointment.terreno_id, // Importante para evitar error NOT NULL
      });

      if (outboxError) {
        console.error(
          "CRITICAL: Appointment created but Event Outbox failed",
          outboxError,
        );
        // No fallamos la request principal, pero logueamos el error crítico
      }
    }

    // 8. Responder Éxito
    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      timezone: "America/Santiago",
    });
  } catch (e: any) {
    return jsonError(e);
  }
}

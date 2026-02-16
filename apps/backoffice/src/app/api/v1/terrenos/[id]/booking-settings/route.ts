import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingSettingsUpdateRequest } from "@vicaper/contracts";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

// --- Helpers de Auth ---
async function requireUser() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    const err = new Error("UNAUTHORIZED");
    (err as any).code = "UNAUTHORIZED";
    throw err;
  }
  return data.user;
}

async function requireTerrenoAdmin(userId: string, terrenoId: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("terreno_members")
    .select("role")
    .eq("terreno_id", terrenoId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") {
    const err = new Error("FORBIDDEN_ADMIN_ONLY");
    (err as any).code = "FORBIDDEN_ADMIN_ONLY";
    throw err;
  }
}

function defaultWorkingHours() {
  return {
    mon: [{ start: "09:00", end: "18:00" }],
    tue: [{ start: "09:00", end: "18:00" }],
    wed: [{ start: "09:00", end: "18:00" }],
    thu: [{ start: "09:00", end: "18:00" }],
    fri: [{ start: "09:00", end: "18:00" }],
    sat: [],
    sun: [],
  };
}

// --- GET ---
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = ParamsSchema.parse(await ctx.params);
    await requireTerrenoAdmin(user.id, id);

    const admin = supabaseAdmin();

    // 1. Datos del Terreno
    const { data: terreno, error: tErr } = await admin
      .from("terrenos")
      .select("id, slug, booking_enabled")
      .eq("id", id)
      .single();
    if (tErr) throw new Error(tErr.message);

    // 2. Settings (incluyendo emails)
    const { data: settings, error: sErr } = await admin
      .from("terreno_booking_settings")
      .select("*")
      .eq("terreno_id", id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);

    // 3. Respuesta Combinada
    const resp = {
      terrenoId: terreno.id,
      slug: (terreno.slug as string | null) ?? "demo-terreno",
      bookingEnabled: Boolean(terreno.booking_enabled),
      timezone: "America/Santiago",
      slotDurationMinutes: Number(settings?.slot_duration_minutes ?? 60),
      bufferMinutes: Number(settings?.buffer_minutes ?? 0),
      workingHours: settings?.working_hours ?? defaultWorkingHours(),
      primaryColor: settings?.primary_color ?? "#2563eb",
      backgroundColor: settings?.background_color ?? "#ffffff",
      logoUrl: settings?.logo_url ?? "",
      // Campos Email
      mailSubject: settings?.mail_subject ?? "Confirmación de Visita",
      mailBody:
        settings?.mail_body ?? "Hola {{name}}, tu visita está confirmada.",
    };

    return NextResponse.json(resp);
  } catch (e: any) {
    return jsonError(e);
  }
}

// --- POST (Debuggeado) ---
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = ParamsSchema.parse(await ctx.params);
    await requireTerrenoAdmin(user.id, id);

    const body = await req.json();

    // LOG DE DEBUG: Ver qué llega realmente desde el frontend
    console.log("📥 [API] Recibiendo update para:", id);
    console.log("📦 Payload:", body);
    const rawMailSubject = body.mail_subject ?? body.mailSubject;
    const rawMailBody = body.mail_body ?? body.mailBody;
    const admin = supabaseAdmin();

    // 1. Obtener estado ACTUAL (DB)
    const { data: currentTerreno } = await admin
      .from("terrenos")
      .select("slug, booking_enabled")
      .eq("id", id)
      .single();
    const { data: currentSettings } = await admin
      .from("terreno_booking_settings")
      .select("*")
      .eq("terreno_id", id)
      .maybeSingle();

    // 2. Preparar datos para Zod (Solo campos estructurales conocidos)
    // Usamos el valor del body si existe, sino el de la DB, sino el default.
    const structData = {
      slug: body.slug ?? currentTerreno?.slug ?? "demo-terreno",
      bookingEnabled:
        body.bookingEnabled ?? currentTerreno?.booking_enabled ?? false,
      slotDurationMinutes:
        body.slotDurationMinutes ??
        currentSettings?.slot_duration_minutes ??
        60,
      bufferMinutes: body.bufferMinutes ?? currentSettings?.buffer_minutes ?? 0,
      workingHours:
        body.workingHours ??
        currentSettings?.working_hours ??
        defaultWorkingHours(),
      primaryColor:
        body.primaryColor ?? currentSettings?.primary_color ?? "#2563eb",
      backgroundColor:
        body.backgroundColor ?? currentSettings?.background_color ?? "#ffffff",
      logoUrl: body.logoUrl ?? currentSettings?.logo_url ?? "",
    };

    // 3. Validar Estructura con Zod
    // Esto asegura que slug, horas, etc. sean correctos.
    const parsed = BookingSettingsUpdateRequest.parse(structData);

    const finalMailSubject =
      rawMailSubject ??
      currentSettings?.mail_subject ??
      "Confirmación de Visita";
    const finalMailBody = rawMailBody ?? currentSettings?.mail_body ?? "";

    // 4. Preparar Emails (Manualmente, fuera de Zod para que no los borre)
    // El frontend envía mailSubject (camelCase), DB usa mail_subject (snake_case)
    const mailSubject =
      body.mailSubject ??
      currentSettings?.mail_subject ??
      "Confirmación de Visita";
    const mailBody = body.mailBody ?? currentSettings?.mail_body ?? "";

    console.log("📧 Guardando Emails:", { mailSubject, mailBody });

    // 5. Guardar en DB
    // A) Terrenos
    const { error: upTerrenoErr } = await admin
      .from("terrenos")
      .update({
        slug: parsed.slug,
        booking_enabled: parsed.bookingEnabled,
      })
      .eq("id", id);

    if (upTerrenoErr) {
      console.error("❌ Error Terreno:", upTerrenoErr);
      throw new Error(upTerrenoErr.message);
    }

    // B) Settings (Upsert explícito)
    const { error: upSettingsErr } = await admin
      .from("terreno_booking_settings")
      .upsert(
        {
          terreno_id: id,
          // Datos validados por Zod
          slot_duration_minutes: parsed.slotDurationMinutes,
          buffer_minutes: parsed.bufferMinutes,
          working_hours: parsed.workingHours,
          primary_color: parsed.primaryColor,
          background_color: parsed.backgroundColor,
          logo_url: parsed.logoUrl,

          // Datos de Email Manuales
          mail_subject: finalMailSubject,
          mail_body: finalMailBody,

          updated_at: new Date().toISOString(),
        },
        { onConflict: "terreno_id" },
      );

    if (upSettingsErr) {
      console.error("❌ Error Settings:", upSettingsErr);
      throw new Error(upSettingsErr.message);
    }

    console.log("✅ Configuración guardada correctamente");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("🔥 EXCEPTION API:", e);
    return jsonError(e);
  }
}

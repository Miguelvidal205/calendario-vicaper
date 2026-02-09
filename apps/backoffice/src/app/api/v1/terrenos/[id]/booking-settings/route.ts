import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BookingSettingsGetResponse,
  BookingSettingsUpdateRequest,
} from "@vicaper/contracts";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

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

  // RLS debería permitir al menos ver su membership
  const { data, error } = await sb
    .from("terreno_members")
    .select("role")
    .eq("terreno_id", terrenoId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error("FORBIDDEN");
    (err as any).code = "FORBIDDEN";
    throw err;
  }
  if (data.role !== "admin") {
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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = ParamsSchema.parse(await ctx.params);

    await requireTerrenoAdmin(user.id, id);

    const admin = supabaseAdmin();

    const { data: terreno, error: tErr } = await admin
      .from("terrenos")
      .select("id, slug, booking_enabled, timezone")
      .eq("id", id)
      .single();

    if (tErr) throw new Error(tErr.message);

    const { data: settings, error: sErr } = await admin
      .from("terreno_booking_settings")
      .select("slot_duration_minutes, buffer_minutes, working_hours")
      .eq("terreno_id", id)
      .maybeSingle();

    if (sErr) throw new Error(sErr.message);

    const resp = BookingSettingsGetResponse.parse({
      terrenoId: terreno.id,
      slug: (terreno.slug as string | null) ?? "demo-terreno",
      bookingEnabled: Boolean(terreno.booking_enabled),
      timezone: "America/Santiago" as const, // forzamos Chile
      slotDurationMinutes: Number(settings?.slot_duration_minutes ?? 60),
      bufferMinutes: Number(settings?.buffer_minutes ?? 0),
      workingHours: (settings?.working_hours ?? defaultWorkingHours()) as any,
    });

    return NextResponse.json(resp);
  } catch (e: any) {
    return jsonError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = ParamsSchema.parse(await ctx.params);
    await requireTerrenoAdmin(user.id, id);

    const body = await req.json();
    const parsed = BookingSettingsUpdateRequest.parse(body);

    const admin = supabaseAdmin();

    // 1) Actualiza terrenos (slug + enabled + timezone fijo Chile)
    const { error: upTerrenoErr } = await admin
      .from("terrenos")
      .update({
        slug: parsed.slug,
        booking_enabled: parsed.bookingEnabled,
        timezone: "America/Santiago",
      })
      .eq("id", id);

    if (upTerrenoErr) {
      // slug unique violation típico
      const msg = upTerrenoErr.message ?? "";
      if (
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("unique")
      ) {
        const err = new Error("SLUG_ALREADY_TAKEN");
        (err as any).code = "SLUG_ALREADY_TAKEN";
        throw err;
      }
      throw new Error(upTerrenoErr.message);
    }

    // 2) Upsert settings
    const { error: upSettingsErr } = await admin
      .from("terreno_booking_settings")
      .upsert(
        {
          terreno_id: id,
          slot_duration_minutes: parsed.slotDurationMinutes,
          buffer_minutes: parsed.bufferMinutes,
          working_hours: parsed.workingHours,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "terreno_id" },
      );

    if (upSettingsErr) throw new Error(upSettingsErr.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e);
  }
}

// apps/backoffice/src/app/api/v1/public/booking/[slug]/availability/route.ts
import { NextResponse } from "next/server";

// ✅ NO subpaths (Turbopack no los resuelve si tu package no los exporta)
import { PublicBookingAvailabilityQuery } from "@vicaper/contracts";
import { BookingService } from "@vicaper/domain";
import { OutboxEventBus } from "@vicaper/events";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { resolveTerrenoBySlugOrThrow } from "@/lib/publicBooking/resolveTerrenoBySlug";
import { getOriginHost } from "@/lib/publicBooking/verifyEmbedOrigin";
import { rateLimitOrThrow } from "@/lib/publicBooking/rateLimit";

// ✅ infra via entrypoint (ya lo exportaste desde packages/infra-supabase/src/index.ts)
import {
  BookingSettingsRepo,
  BookingAppointmentsRepo,
  AssigneeResolver,
} from "@vicaper/infra-supabase";

function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
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
    const err = new Error("Origin not allowed");
    (err as any).code = "ORIGIN_NOT_ALLOWED";
    throw err;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const url = new URL(req.url);

    const parsed = PublicBookingAvailabilityQuery.parse({
      date: url.searchParams.get("date"),
    });

    const admin = supabaseAdmin();

    const { terrenoId } = await resolveTerrenoBySlugOrThrow(admin, slug);

    await verifyOriginAllowed(admin, terrenoId, getOriginHost(req));

    await rateLimitOrThrow({
      admin,
      slug,
      ip: getClientIp(req),
      limit: 60,
      windowSeconds: 300,
    });

    const service = new BookingService({
      appointments: new BookingAppointmentsRepo(admin),
      settings: new BookingSettingsRepo(admin),
      assignees: new AssigneeResolver(admin),
    });

    const avail = await service.getAvailability({
      terrenoId,
      date: parsed.date,
    });

    // Si tu OutboxEventBus se usa solo para creación de booking,
    // acá no se necesita. Si tu BookingService lo requiere, decímelo.

    return NextResponse.json({
      terrenoId,
      timezone: avail.timezone,
      date: parsed.date,
      slotDurationMinutes: avail.slotDurationMinutes,
      slots: avail.slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
    });
  } catch (e: any) {
    return jsonError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import {
  PublicBookingCreateRequest,
  PublicBookingCreateResponse,
} from "@vicaper/contracts";
import { sha256Hex } from "@/lib/publicBooking/bookingKey";
import { makePublicBookingService } from "@/lib/compose/makePublicBookingService";
import { toChileDateTime } from "@/lib/time/toChileDateTime";

const ParamsSchema = z.object({
  slug: z.string().min(2).max(200),
});

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

async function resolveTerrenoBySlug(
  admin: ReturnType<typeof supabaseAdmin>,
  slug: string,
) {
  const { data, error } = await admin
    .from("terrenos")
    .select("id, booking_enabled")
    .eq("slug", slug)
    .single();

  if (error) throw new Error(error.message);
  if (!data.booking_enabled) {
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
    .single();

  if (error) throw new Error(error.message);

  const got = sha256Hex(bookingKey);
  if (got !== String((data as any).booking_key_hash)) {
    const err = new Error("BOOKING_UNAUTHORIZED");
    (err as any).code = "BOOKING_UNAUTHORIZED";
    throw err;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = ParamsSchema.parse(await ctx.params);

    const body = await req.json();
    const parsed = PublicBookingCreateRequest.parse(body);

    const admin = supabaseAdmin();
    const { terrenoId } = await resolveTerrenoBySlug(admin, slug);

    await verifyOriginAllowed(admin, terrenoId, originHost(req));
    await verifyBookingKey(admin, terrenoId, parsed.bookingKey);

    const { date, time } = toChileDateTime(parsed.startsAt);

    const service = await makePublicBookingService(admin);

    // Tu createBooking espera date/time, no startsAt
    const created = await (service as any).createBooking({
      terrenoId,
      date,
      time,
      visitorName: parsed.visitorName,
      visitorEmail: parsed.visitorEmail,
      visitorPhone: parsed.visitorPhone,
      notes: parsed.notes,
    });

    const resp = PublicBookingCreateResponse.parse({
      appointmentId: created.id,
    });
    return NextResponse.json(resp);
  } catch (e: any) {
    return jsonError(e);
  }
}

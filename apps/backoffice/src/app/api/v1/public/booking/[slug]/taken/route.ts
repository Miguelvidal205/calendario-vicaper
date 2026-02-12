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

function isoBoundsForDate(date: string) {
  // bounds en UTC (para filtrar día). Los ISO reales se muestran en UI con TZ Chile.
  const from = new Date(`${date}T00:00:00.000Z`).toISOString();
  const to = new Date(`${date}T23:59:59.999Z`).toISOString();
  return { from, to };
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

    const { from, to } = isoBoundsForDate(q.date);

    // Ajusta nombres de tabla/columnas si tu esquema difiere:
    const { data, error } = await admin
      .from("appointments")
      .select("id, starts_at, ends_at, status")
      .eq("terreno_id", terrenoId)
      .eq("status", "scheduled")
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      date: q.date,
      timezone: "America/Santiago",
      taken: (data ?? []).map((r: any) => ({
        id: r.id,
        startsAt: new Date(r.starts_at).toISOString(),
        endsAt: new Date(r.ends_at).toISOString(),
      })),
    });
  } catch (e: any) {
    return jsonError(e);
  }
}

// apps/backoffice/src/lib/publicBooking/rateLimit.ts
import { sha256Hex } from "./verifyBookingKey";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function rateLimitOrThrow(opts: {
  admin: SupabaseClient;
  slug: string;
  ip: string;
  limit: number; // ej 60
  windowSeconds: number; // ej 300
}) {
  const ipHash = await sha256Hex(opts.ip);
  const key = `booking:${opts.slug}:${ipHash.slice(0, 24)}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - opts.windowSeconds * 1000);

  // Lee actual
  const { data, error } = await opts.admin
    .from("public_rate_limits")
    .select("key, window_start, count")
    .eq("key", key)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    const { error: insErr } = await opts.admin
      .from("public_rate_limits")
      .insert({ key, window_start: now.toISOString(), count: 1 });
    if (insErr) throw new Error(insErr.message);
    return;
  }

  const ws = new Date(data.window_start as string);
  if (ws < windowStart) {
    const { error: upErr } = await opts.admin
      .from("public_rate_limits")
      .update({ window_start: now.toISOString(), count: 1 })
      .eq("key", key);
    if (upErr) throw new Error(upErr.message);
    return;
  }

  const count = Number(data.count);
  if (count >= opts.limit) {
    const err = new Error("Too many requests");
    (err as any).code = "RATE_LIMITED";
    throw err;
  }

  const { error: incErr } = await opts.admin
    .from("public_rate_limits")
    .update({ count: count + 1 })
    .eq("key", key);

  if (incErr) throw new Error(incErr.message);
}

// apps/backoffice/src/lib/publicBooking/resolveTerrenoBySlug.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveTerrenoBySlugOrThrow(
  admin: SupabaseClient,
  slug: string,
) {
  const { data: terreno, error } = await admin
    .from("terrenos")
    .select("id, slug, booking_enabled, timezone")
    .eq("slug", slug)
    .single();

  if (error) throw new Error(error.message);
  if (!terreno.booking_enabled) {
    const err = new Error("Booking disabled");
    (err as any).code = "BOOKING_DISABLED";
    throw err;
  }

  const { data: keyRow, error: kErr } = await admin
    .from("terreno_booking_keys")
    .select("booking_key_hash")
    .eq("terreno_id", terreno.id)
    .single();

  if (kErr) throw new Error(kErr.message);

  return {
    terrenoId: terreno.id as string,
    timezone: terreno.timezone as string,
    bookingKeyHash: keyRow.booking_key_hash as string,
  };
}

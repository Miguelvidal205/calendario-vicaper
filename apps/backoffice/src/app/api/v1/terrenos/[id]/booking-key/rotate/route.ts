import { NextResponse } from "next/server";
import { z } from "zod";
import { RotateBookingKeyResponse } from "@vicaper/contracts";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { generateBookingKey, sha256Hex } from "@/lib/publicBooking/bookingKey";

const ParamsSchema = z.object({ id: z.string().uuid() });

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = ParamsSchema.parse(await ctx.params);
    await requireTerrenoAdmin(user.id, id);

    const admin = supabaseAdmin();

    const bookingKey = generateBookingKey();
    const bookingKeyHash = sha256Hex(bookingKey);

    const { error } = await admin.from("terreno_booking_keys").upsert(
      {
        terreno_id: id,
        booking_key_hash: bookingKeyHash,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "terreno_id" },
    );

    if (error) throw new Error(error.message);

    const resp = RotateBookingKeyResponse.parse({
      terrenoId: id,
      bookingKey,
    });

    return NextResponse.json(resp);
  } catch (e: any) {
    return jsonError(e);
  }
}

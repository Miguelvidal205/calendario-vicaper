import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  domainId: z.string().uuid(),
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
  const { data, error } = await sb
    .from("terreno_users")
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

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; domainId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, domainId } = ParamsSchema.parse(await ctx.params);
    await requireTerrenoAdmin(user.id, id);

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("terreno_embed_domains")
      .delete()
      .eq("id", domainId)
      .eq("terreno_id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e);
  }
}

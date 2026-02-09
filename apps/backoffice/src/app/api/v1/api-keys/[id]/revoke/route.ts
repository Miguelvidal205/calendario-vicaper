import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const terrenoId = await requireActiveTerrenoId();
    const { id } = await ctx.params;

    // chequear admin
    const { data: mem, error: memErr } = await sb
      .from("terreno_members")
      .select("role")
      .eq("terreno_id", terrenoId)
      .eq("user_id", userRes.user.id)
      .maybeSingle<{ role: "admin" | "agent" | "installer" }>();

    if (memErr) throw new Error(memErr.message);
    if (!mem || mem.role !== "admin") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin role required" } },
        { status: 403 },
      );
    }

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("terreno_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("terreno_id", terrenoId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http/errorResponse";

const Body = z.object({
  terrenoId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();

    if (userErr || !userRes.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const parsed = Body.parse(await req.json());

    // Validar membership (RLS debe permitir select a terreno_members)
    const { data: mem, error: memErr } = await sb
      .from("terreno_members")
      .select("id")
      .eq("terreno_id", parsed.terrenoId)
      .eq("user_id", userRes.user.id)
      .maybeSingle<{ id: string }>();

    if (memErr) throw new Error(memErr.message);
    if (!mem) {
      return NextResponse.json(
        {
          error: { code: "FORBIDDEN", message: "Not a member of this terreno" },
        },
        { status: 403 },
      );
    }

    const store = await cookies();
    store.set("active_terreno_id", parsed.terrenoId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

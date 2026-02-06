import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { cookies } from "next/headers";

const CreateBody = z.object({
  name: z.string().min(2).max(120),
});

export async function GET() {
  try {
    const sb = await supabaseServer();
    const { data: userRes, error: userErr } = await sb.auth.getUser();

    if (userErr || !userRes.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const { data, error } = await sb
      .from("terrenos")
      .select("id,name,created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ terrenos: data ?? [] });
  } catch (err) {
    return jsonError(err);
  }
}

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

    const parsed = CreateBody.parse(await req.json());
    const admin = supabaseAdmin();

    const { data: terreno, error: terrErr } = await admin
      .from("terrenos")
      .insert({ name: parsed.name })
      .select("id,name,created_at")
      .single();

    if (terrErr || !terreno)
      throw new Error(terrErr?.message ?? "Failed to create terreno");

    const { error: memErr } = await admin.from("terreno_members").insert({
      terreno_id: terreno.id,
      user_id: userRes.user.id,
      role: "admin",
    });

    if (memErr) throw new Error(memErr.message);

    const store = await cookies();
    store.set("active_terreno_id", terreno.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ terreno }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

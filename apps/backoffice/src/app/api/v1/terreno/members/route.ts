import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { jsonError } from "@/lib/http/errorResponse";

type MemberRow = {
  user_id: string;
  role: "admin" | "agent" | "installer";
};

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

    const terrenoId = await requireActiveTerrenoId();

    // RLS: el usuario debe poder ver terreno_members del terreno donde pertenece.
    const { data, error } = await sb
      .from("terreno_members")
      .select("user_id, role")
      .eq("terreno_id", terrenoId)
      .order("role", { ascending: true })
      .returns<MemberRow[]>();

    if (error) throw new Error(error.message);

    // MVP: devolvemos solo IDs/roles (sin email) para no depender de auth.users.
    // Luego añadimos profiles table para mostrar nombre/email.
    return NextResponse.json({ members: data ?? [] });
  } catch (err) {
    return jsonError(err);
  }
}

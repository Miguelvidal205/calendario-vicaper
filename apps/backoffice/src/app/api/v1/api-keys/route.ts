import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";
import { requireActiveTerrenoId } from "@/lib/terreno/activeTerreno";
import { generateApiKey, hashApiKey, last4 } from "@/lib/apiKeys/apiKey";

const CreateBody = z.object({
  name: z.string().min(2).max(80),
});

type KeyRow = {
  id: string;
  name: string | null;
  last4: string | null;
  created_at: string;
  revoked_at: string | null;
};

async function requireAdminForTerreno(userId: string, terrenoId: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("terreno_members")
    .select("role")
    .eq("terreno_id", terrenoId)
    .eq("user_id", userId)
    .maybeSingle<{ role: "admin" | "agent" | "installer" }>();

  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") {
    return false;
  }
  return true;
}

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

    // Listar metadata (RLS debería permitir select si eres miembro)
    const { data, error } = await sb
      .from("terreno_api_keys")
      .select("id,name,last4,created_at,revoked_at")
      .eq("terreno_id", terrenoId)
      .order("created_at", { ascending: false })
      .returns<KeyRow[]>();

    if (error) throw new Error(error.message);
    return NextResponse.json({ keys: data ?? [] });
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

    const terrenoId = await requireActiveTerrenoId();
    const okAdmin = await requireAdminForTerreno(userRes.user.id, terrenoId);

    if (!okAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin role required" } },
        { status: 403 },
      );
    }

    const parsed = CreateBody.parse(await req.json());
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    const admin = supabaseAdmin();

    const { data: inserted, error } = await admin
      .from("terreno_api_keys")
      .insert({
        terreno_id: terrenoId,
        name: parsed.name,
        key_hash: keyHash,
        last4: last4(apiKey),
      })
      .select("id,name,last4,created_at,revoked_at")
      .single<KeyRow>();

    if (error || !inserted)
      throw new Error(error?.message ?? "Failed to create api key");

    // ⚠️ apiKey solo se devuelve una vez
    return NextResponse.json({ key: inserted, apiKey }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EmbedDomainCreateRequest,
  EmbedDomainsListResponse,
} from "@vicaper/contracts";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http/errorResponse";

const ParamsSchema = z.object({ id: z.string().uuid() });

function normalizeDomain(input: string) {
  // acepta "https://x.com" o "x.com" o "localhost:3000"
  const v = input.trim().toLowerCase();
  if (!v) return v;
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    return u.host; // incluye puerto si aplica
  } catch {
    return v;
  }
}

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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = ParamsSchema.parse(await ctx.params);
    await requireTerrenoAdmin(user.id, id);

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("terreno_embed_domains")
      .select("id, domain, enabled")
      .eq("terreno_id", id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const resp = EmbedDomainsListResponse.parse({
      terrenoId: id,
      items: (data ?? []).map((r: any) => ({
        id: r.id,
        domain: r.domain,
        enabled: Boolean(r.enabled),
      })),
    });

    return NextResponse.json(resp);
  } catch (e: any) {
    return jsonError(e);
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

    const body = await req.json();
    const parsed = EmbedDomainCreateRequest.parse(body);

    const domain = normalizeDomain(parsed.domain);
    if (!domain) {
      const err = new Error("INVALID_DOMAIN");
      (err as any).code = "INVALID_DOMAIN";
      throw err;
    }

    const admin = supabaseAdmin();
    const { error } = await admin.from("terreno_embed_domains").insert({
      terreno_id: id,
      domain,
      enabled: parsed.enabled ?? true,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e);
  }
}

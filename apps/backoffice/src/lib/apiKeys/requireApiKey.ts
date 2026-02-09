import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashApiKey } from "./apiKey";

export class ApiKeyError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "ApiKeyError";
    this.code = code;
    this.status = status;
  }
}

function extractApiKey(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (h && h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7).trim();
  }
  const x = req.headers.get("x-api-key");
  return x?.trim() ?? null;
}

export async function requireApiKeyTerreno(
  req: Request,
): Promise<{ terrenoId: string; apiKeyId: string }> {
  const apiKey = extractApiKey(req);
  if (!apiKey) throw new ApiKeyError("MISSING_API_KEY", 401, "Missing API key");

  const admin = supabaseAdmin();
  const keyHash = hashApiKey(apiKey);

  const { data, error } = await admin
    .from("terreno_api_keys")
    .select("id, terreno_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle<{
      id: string;
      terreno_id: string;
      revoked_at: string | null;
    }>();

  if (error) throw new ApiKeyError("API_KEY_LOOKUP_FAILED", 500, error.message);
  if (!data) throw new ApiKeyError("INVALID_API_KEY", 401, "Invalid API key");
  if (data.revoked_at)
    throw new ApiKeyError("REVOKED_API_KEY", 401, "Revoked API key");

  return { terrenoId: data.terreno_id, apiKeyId: data.id };
}

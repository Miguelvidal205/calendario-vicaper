import crypto from "node:crypto";

export function generateApiKey(): string {
  // Formato legible y versionable
  const raw = crypto.randomBytes(32).toString("base64url");
  return `vpk_${raw}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function last4(apiKey: string): string {
  return apiKey.slice(-4);
}

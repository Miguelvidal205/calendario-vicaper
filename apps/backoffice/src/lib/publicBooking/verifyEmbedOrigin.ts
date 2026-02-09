// apps/backoffice/src/lib/publicBooking/verifyEmbedOrigin.ts
export function getOriginHost(req: Request): string | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const raw = origin ?? referer;
  if (!raw) return null;

  try {
    const u = new URL(raw);
    return u.host; // incluye subdominio + puerto si aplica
  } catch {
    return null;
  }
}

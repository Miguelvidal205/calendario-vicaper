// apps/backoffice/src/lib/publicBooking/verifyBookingKey.ts
import { validationError } from "@vicaper/domain";

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifica una key simple para booking (ej: embed key / shared secret),
 * sin depender de subpaths tipo @vicaper/domain/booking/BookingService.
 *
 * Ajustá el criterio según tu diseño (header, query param, etc.)
 */
export async function verifyBookingKeyOrThrow(opts: {
  expectedKey: string;
  providedKey: string | null;
  context?: Record<string, unknown>;
}) {
  const expected = opts.expectedKey?.trim();
  if (!expected) {
    // si no hay expectedKey configurada, lo dejamos pasar (modo dev)
    return;
  }

  const provided = (opts.providedKey ?? "").trim();
  if (!provided) {
    throw validationError("Missing booking key", opts.context);
  }

  // comparación en hash para evitar comparaciones directas “obvias”
  const [a, b] = await Promise.all([sha256Hex(expected), sha256Hex(provided)]);

  if (a !== b) {
    // Si en tu domain no existe forbiddenError, cambialo por validationError o infraError.
    throw validationError("Invalid booking key");
  }
}

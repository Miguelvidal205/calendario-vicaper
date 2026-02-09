import crypto from "crypto";

export function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function generateBookingKey() {
  // 32 bytes → string URL-safe
  return crypto.randomBytes(32).toString("base64url"); // Node 18+
}

import { timingSafeEqual } from "node:crypto";

// Constant-time compare against RESOURCE_ADMIN_TOKEN. Length mismatch returns
// false immediately (length is not the secret here); equal-length inputs are
// compared via timingSafeEqual to avoid per-byte timing leaks under load.
export function verifyAdminToken(provided: unknown): boolean {
  const expected = process.env.RESOURCE_ADMIN_TOKEN;
  if (!expected || typeof provided !== "string") return false;
  if (provided.length !== expected.length) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return timingSafeEqual(a, b);
}

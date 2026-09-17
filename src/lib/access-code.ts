import { createHash, timingSafeEqual } from "node:crypto";

// Fails closed: with no code configured, nobody can sign up. Both sides are
// hashed first so the comparison is constant-time regardless of length.
export function accessCodeMatches(
  given: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

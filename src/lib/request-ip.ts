import "server-only";
import { headers } from "next/headers";

// Best-effort client IP for rate-limiting keys only — NOT used for any
// authorization decision. `x-forwarded-for` is only trustworthy behind a
// reverse proxy that sets it correctly (Namecheap/Vercel/etc.); if it's
// absent (e.g. local dev with no proxy in front) this falls back to a
// constant, which still lets per-email rate limiting work correctly.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

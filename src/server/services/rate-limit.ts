import "server-only";

// In-memory sliding-window limiter. Deliberately simple: this app runs as a
// single Node process (see docs/architecture.md's Namecheap hosting notes),
// so a per-process Map is a real, working defense against basic brute-force
// / signup-spam without adding infrastructure. If the app is later deployed
// across multiple instances/workers, replace the Map below with a shared
// store (e.g. Redis/Upstash) — call sites (checkRateLimit) won't need to
// change, only this file's internals.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many attempts. Please wait a few minutes and try again.");
    this.name = "RateLimitError";
  }
}

export function checkRateLimit(key: string, opts: { max: number; windowMs: number }): void {
  const now = Date.now();

  // Opportunistic cleanup so long-running processes don't accumulate stale
  // entries forever. Cheap relative to the request itself.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  if (existing.count >= opts.max) {
    throw new RateLimitError(Math.ceil((existing.resetAt - now) / 1000));
  }

  existing.count += 1;
}

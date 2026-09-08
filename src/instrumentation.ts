// Next.js instrumentation hook — runs once when the server process starts,
// in every runtime Next.js boots (we only care about the Node one, since
// this touches Prisma). This is what makes the expiry sweep "reliable even
// if no user visits the website": it starts on server boot, not on request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validated first, and allowed to throw — a genuinely broken config
    // (missing DB URL, placeholder AUTH_SECRET, production pointed at
    // localhost) should stop the process from ever serving traffic, not
    // fail confusingly later on the first request. See env-check.ts.
    const { validateEnvironment } = await import("@/lib/env-check");
    validateEnvironment();

    const { startExpiryScheduler } = await import("@/server/services/expiry-service");
    startExpiryScheduler();
  }
}

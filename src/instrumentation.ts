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

    // Performance: a freshly started server has empty in-memory caches (see
    // lib/swr-cache.ts) and, after a quiet spell, a suspended Neon database
    // that takes a few seconds to wake. Start loading the data every public
    // page needs right away, in the background, so the first visitor after a
    // restart or deploy doesn't pay for both. Not awaited — never delays
    // startup — and failures are only logged; the first request then simply
    // loads the data the normal way.
    void (async () => {
      try {
        const { getCategoryCounts, getMakeModelIndex, getPublicListings } = await import(
          "@/server/services/listing-service"
        );
        await Promise.all([getCategoryCounts(), getMakeModelIndex(), getPublicListings({ sort: "featured", page: 1 })]);
      } catch (error) {
        console.error("[startup] cache warm-up failed:", error);
      }
    })();

    // Resized photo copies (see lib/upload-variant-files.ts) live on disk and
    // survive restarts, but photos uploaded before they existed — or whose
    // copies were cleared — would make their first visitor wait for a resize.
    // Make the common sizes for every public listing photo once, slowly, in
    // the background (it queues behind any visitor's request). Photos that
    // already have them are skipped with a quick file check.
    void (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 15_000));
        const [{ prisma }, { pregenerateVariants }] = await Promise.all([
          import("@/lib/prisma"),
          import("@/lib/upload-variant-files"),
        ]);
        const images = await prisma.carImage.findMany({
          where: { listing: { status: { in: ["ACTIVE", "SOLD"] } } },
          select: { imageUrl: true },
          orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
          take: 2000,
        });
        for (const { imageUrl } of images) await pregenerateVariants(imageUrl);
      } catch (error) {
        console.error("[startup] photo size warm-up failed:", error);
      }
    })();
  }
}

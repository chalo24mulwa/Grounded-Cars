import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/services/notification-service";

// ----------------------------------------------------------------------------
// The one scheduled/background job in the app. Three independent sweeps, run
// together since they're all "time has passed, quietly change some state or
// send a heads-up" jobs with the same reliability requirement:
//
//   1. Featured subscriptions past their expiresAt → EXPIRED, with a
//      SUBSCRIPTION_EXPIRED notification. Doesn't change PUBLIC visibility
//      by itself — getFeaturedListingIds() in featured-service.ts already
//      excludes expired subscriptions on every read purely from expiresAt,
//      regardless of this sweep. This sweep exists so the SELLER-facing
//      status is accurate — "Expired," not a stale-looking "Active."
//   2. Subscription expiry reminders (7/3/1 days before expiresAt) — Phase 8.
//   3. Listings SOLD 14+ days ago → ARCHIVED. This is a real visibility
//      change: ARCHIVED is excluded from all public listing queries. The
//      underlying row, images, and full status history are NEVER deleted
//      — only Phase 1's non-destructive ARCHIVED status is applied, via
//      the exact same mechanism a seller's own "Archive" action uses.
//
// Idempotency (Phase 8 hardening — see Phase 8 tests): this sweep can run
// more than once concurrently — the in-process hourly timer and the
// external POST /api/cron/expiry trigger overlapping, or two app instances
// both ticking, are both real possibilities, not hypotheticals. Every write
// below is therefore a *conditional* update whose WHERE clause includes the
// pre-condition (status still ACTIVE / still SOLD), and the notification
// only fires when that specific call is the one that actually flipped the
// row (`count === 1`). A second concurrent call finds the row already
// changed, its own conditional update matches zero rows, and it correctly
// does nothing — no duplicate notification, no duplicate status change, no
// duplicate history row. Reminders use a separate mechanism (a unique
// `SubscriptionReminder` claim row, see below) since the subscription's own
// status doesn't change at the 7/3/1-day mark, so there's no status flip to
// guard on.
//
// Deliberately bypasses changeListingStatus()/assertValidTransition() for
// step 3: those are shaped around an authenticated *human* actor (they
// call requireListingOwnership(), which needs a session). This sweep has
// no user — it's a trusted system action, invoked only from
// instrumentation.ts's in-process timer or the bearer-token-protected
// /api/cron/expiry route, never from user input. It still writes a
// ListingStatusHistory row per listing (changedById: null) so the audit
// trail stays complete either way.
// ----------------------------------------------------------------------------

const SOLD_AUTO_ARCHIVE_DAYS = 14;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const REMINDER_THRESHOLDS_DAYS = [7, 3, 1] as const;

async function expireSubscriptions(now: Date) {
  const candidates = await prisma.featuredSubscription.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    select: { id: true, userId: true, listingId: true, listing: { select: { title: true } } },
  });

  let expiredCount = 0;

  for (const sub of candidates) {
    // The WHERE clause repeats status: "ACTIVE" — this single statement is
    // what wins the race between two concurrent sweeps. Only the call that
    // actually flips the row (count === 1) sends the notification.
    const result = await prisma.featuredSubscription.updateMany({
      where: { id: sub.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    if (result.count === 0) continue;

    expiredCount += 1;
    await notify({
      userId: sub.userId,
      type: "SUBSCRIPTION_EXPIRED",
      vars: { listingTitle: sub.listing.title },
      relatedEntityType: "FeaturedSubscription",
      relatedEntityId: sub.id,
    });
  }

  return expiredCount;
}

async function sendExpiryReminders(now: Date) {
  const maxWindowMs = Math.max(...REMINDER_THRESHOLDS_DAYS) * 24 * 60 * 60 * 1000;
  const candidates = await prisma.featuredSubscription.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now, lte: new Date(now.getTime() + maxWindowMs) } },
    select: { id: true, userId: true, expiresAt: true, listing: { select: { title: true } } },
  });

  let sentCount = 0;

  for (const sub of candidates) {
    if (!sub.expiresAt) continue;
    const msRemaining = sub.expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    for (const threshold of REMINDER_THRESHOLDS_DAYS) {
      if (daysRemaining > threshold) continue;

      const reminderType = `EXPIRING_${threshold}D`;

      // Claim-then-send: try to INSERT the unique (subscriptionId,
      // reminderType) row first. A unique-constraint violation means
      // another sweep run (or an earlier tick) already claimed and sent
      // this exact reminder — skip, don't retry, don't send again. This is
      // what makes "a reminder is not repeatedly sent for the same event"
      // true even under concurrent execution, not just single-process
      // sequential execution.
      try {
        await prisma.subscriptionReminder.create({
          data: { subscriptionId: sub.id, reminderType },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue; // already sent — expected under concurrent/repeated sweeps
        }
        throw error;
      }

      sentCount += 1;
      await notify({
        userId: sub.userId,
        type: "SUBSCRIPTION_EXPIRING_SOON",
        vars: { listingTitle: sub.listing.title, daysRemaining },
        relatedEntityType: "FeaturedSubscription",
        relatedEntityId: sub.id,
      });
    }
  }

  return sentCount;
}

async function archiveStaleSoldListings(now: Date) {
  const cutoff = new Date(now.getTime() - SOLD_AUTO_ARCHIVE_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.carListing.findMany({
    where: { status: "SOLD", soldAt: { lte: cutoff } },
    select: { id: true },
  });

  let archivedCount = 0;

  for (const listing of candidates) {
    // Same conditional-update race guard as expireSubscriptions() above:
    // only proceed to write history if this call is the one that actually
    // flipped SOLD → ARCHIVED.
    const result = await prisma.carListing.updateMany({
      where: { id: listing.id, status: "SOLD" },
      data: { status: "ARCHIVED" },
    });
    if (result.count === 0) continue;

    archivedCount += 1;
    await prisma.listingStatusHistory.create({
      data: {
        listingId: listing.id,
        fromStatus: "SOLD",
        toStatus: "ARCHIVED",
        changedById: null,
        note: `Automatically archived — sold more than ${SOLD_AUTO_ARCHIVE_DAYS} days ago.`,
      },
    });
  }

  return archivedCount;
}

export async function runExpirySweep() {
  const now = new Date();

  const expiredSubscriptions = await expireSubscriptions(now);
  const remindersSent = await sendExpiryReminders(now);
  const autoArchivedListings = await archiveStaleSoldListings(now);

  return {
    expiredSubscriptions,
    remindersSent,
    autoArchivedListings,
    ranAt: now,
  };
}

let schedulerStarted = false;

/** Starts the in-process hourly sweep. Called once from instrumentation.ts
 * when the server boots — guarded against double-start because Next.js dev
 * mode can invoke the instrumentation hook more than once across recompiles. */
export function startExpiryScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  runExpirySweep().catch((error) => console.error("Initial expiry sweep failed:", error));
  setInterval(() => {
    runExpirySweep().catch((error) => console.error("Scheduled expiry sweep failed:", error));
  }, SWEEP_INTERVAL_MS);
}

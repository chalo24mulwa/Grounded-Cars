/**
 * Standalone verification script for Phase 8's background-job safety
 * requirements — the ones that specifically need concurrent execution,
 * which can't be exercised by clicking through a browser:
 *
 *   - Duplicate background job execution (two overlapping sweeps)
 *   - Duplicate reminder prevention (the same 7/3/1-day reminder is never
 *     sent twice, even under concurrent/repeated sweep runs)
 *   - Retry behavior is safe (running the sweep again after it already
 *     processed everything changes nothing)
 *
 * Creates its own throwaway FeaturedSubscription fixtures against existing
 * seed data (a seller + one of their ACTIVE listings + an active plan),
 * asserts on the results, then deletes everything it created — never
 * touches unrelated data, and cleans up even if an assertion fails.
 *
 * Run with (Windows PowerShell):
 *   $env:NODE_OPTIONS = "--require ./scripts/_server-only-shim.cjs"; npx tsx scripts/verify-phase8-idempotency.ts
 * Run with (bash):
 *   NODE_OPTIONS="--require ./scripts/_server-only-shim.cjs" npx tsx scripts/verify-phase8-idempotency.ts
 *
 * (The --require shim is needed because this script imports real service
 * files that start with `import "server-only"` — see
 * scripts/_server-only-shim.cjs for why that needs a preload outside Next's
 * own bundler.)
 */
import { prisma } from "../src/lib/prisma";
import { runExpirySweep } from "../src/server/services/expiry-service";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function main() {
  const seller = await prisma.user.findFirstOrThrow({ where: { email: "seller@example.com" } });
  const listing = await prisma.carListing.findFirstOrThrow({
    where: { sellerId: seller.id, status: "ACTIVE" },
  });
  const plan = await prisma.featuredPlan.findFirstOrThrow({ where: { active: true } });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  console.log("Creating throwaway fixtures...");
  const expiredSub = await prisma.featuredSubscription.create({
    data: {
      userId: seller.id,
      listingId: listing.id,
      planId: plan.id,
      status: "ACTIVE",
      startedAt: new Date(now - 10 * DAY),
      expiresAt: new Date(now - DAY), // already expired
    },
  });
  const soonToExpireSub = await prisma.featuredSubscription.create({
    data: {
      userId: seller.id,
      listingId: listing.id,
      planId: plan.id,
      status: "ACTIVE",
      startedAt: new Date(now - DAY),
      expiresAt: new Date(now + 2 * DAY), // 2 days remaining -> matches 7D and 3D thresholds, not 1D
    },
  });

  const cleanup = async () => {
    await prisma.notification.deleteMany({
      where: { relatedEntityId: { in: [expiredSub.id, soonToExpireSub.id] } },
    });
    await prisma.subscriptionReminder.deleteMany({
      where: { subscriptionId: { in: [expiredSub.id, soonToExpireSub.id] } },
    });
    await prisma.featuredSubscription.deleteMany({
      where: { id: { in: [expiredSub.id, soonToExpireSub.id] } },
    });
  };

  try {
    console.log("\n--- Test 1: two concurrent sweeps (duplicate job execution) ---");
    const [resultA, resultB] = await Promise.all([runExpirySweep(), runExpirySweep()]);
    console.log("  sweep A:", resultA);
    console.log("  sweep B:", resultB);

    const expiredNow = await prisma.featuredSubscription.findUniqueOrThrow({
      where: { id: expiredSub.id },
    });
    assert(expiredNow.status === "EXPIRED", "expired subscription flipped to EXPIRED exactly once");

    const expiredNotifications = await prisma.notification.count({
      where: { relatedEntityId: expiredSub.id, type: "SUBSCRIPTION_EXPIRED" },
    });
    assert(
      expiredNotifications === 1,
      `exactly one SUBSCRIPTION_EXPIRED notification was created (found ${expiredNotifications}), not one per concurrent sweep`
    );

    const reminder7d = await prisma.subscriptionReminder.count({
      where: { subscriptionId: soonToExpireSub.id, reminderType: "EXPIRING_7D" },
    });
    const reminder3d = await prisma.subscriptionReminder.count({
      where: { subscriptionId: soonToExpireSub.id, reminderType: "EXPIRING_3D" },
    });
    const reminder1d = await prisma.subscriptionReminder.count({
      where: { subscriptionId: soonToExpireSub.id, reminderType: "EXPIRING_1D" },
    });
    assert(reminder7d === 1, `exactly one EXPIRING_7D reminder claim exists (found ${reminder7d})`);
    assert(reminder3d === 1, `exactly one EXPIRING_3D reminder claim exists (found ${reminder3d})`);
    assert(reminder1d === 0, `no EXPIRING_1D reminder yet — only 2 days remain, not <=1 (found ${reminder1d})`);

    const reminderNotifications = await prisma.notification.count({
      where: { relatedEntityId: soonToExpireSub.id, type: "SUBSCRIPTION_EXPIRING_SOON" },
    });
    assert(
      reminderNotifications === 2,
      `exactly two SUBSCRIPTION_EXPIRING_SOON notifications (7D + 3D), not four from the two concurrent sweeps (found ${reminderNotifications})`
    );

    console.log("\n--- Test 2: a third sweep afterward (retry behavior is safe) ---");
    const resultC = await runExpirySweep();
    console.log("  sweep C:", resultC);

    const expiredNotificationsAfterRetry = await prisma.notification.count({
      where: { relatedEntityId: expiredSub.id, type: "SUBSCRIPTION_EXPIRED" },
    });
    assert(
      expiredNotificationsAfterRetry === 1,
      "retrying the sweep after everything already processed creates no additional expiry notification"
    );

    const reminder7dAfterRetry = await prisma.subscriptionReminder.count({
      where: { subscriptionId: soonToExpireSub.id, reminderType: "EXPIRING_7D" },
    });
    assert(
      reminder7dAfterRetry === 1,
      "retrying the sweep creates no additional reminder claim for an already-sent reminder"
    );

    console.log("\nAll Phase 8 background-job safety assertions passed.");
  } finally {
    console.log("\nCleaning up throwaway fixtures...");
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("\nVERIFICATION FAILED:", error);
  process.exit(1);
});

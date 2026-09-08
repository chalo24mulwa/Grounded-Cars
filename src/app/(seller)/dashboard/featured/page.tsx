import {
  getActiveFeaturedPlans,
  getMyFeaturedSubscriptions,
  extractMpesaReceipt,
} from "@/server/services/featured-service";
import { getMyListings } from "@/server/services/listing-service";
import { isMpesaConfigured } from "@/lib/mpesa";
import { FeatureListingForm } from "@/components/dashboard/FeatureListingForm";
import { SubscriptionHistory, type SubscriptionRow } from "@/components/dashboard/SubscriptionHistory";

export const metadata = { title: "Featured Listings" };

export default async function FeaturedListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  const { listingId } = await searchParams;

  const [plans, subscriptions, myListings] = await Promise.all([
    getActiveFeaturedPlans(),
    getMyFeaturedSubscriptions(),
    getMyListings(),
  ]);

  const activeListings = myListings
    .filter((l) => l.status === "ACTIVE")
    .map((l) => ({ id: l.id, title: l.title }));

  const now = Date.now();
  const rows: SubscriptionRow[] = subscriptions.map((sub) => ({
    id: sub.id,
    status: sub.status,
    startedAt: sub.startedAt?.toISOString() ?? null,
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    daysRemaining: sub.expiresAt
      ? Math.max(0, Math.ceil((sub.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)))
      : null,
    listingTitle: sub.listing.title,
    planName: sub.plan.name,
    payments: sub.payments.map((p) => ({
      id: p.id,
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
      receiptNumber: extractMpesaReceipt(p.metadata),
    })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Featured Listings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pay to feature one of your active listings — featured cars get a Verified badge and
        premium placement at the top of the marketplace and on the Best Deals page.
      </p>

      <div className="mt-6">
        {activeListings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            You need at least one ACTIVE listing before you can feature it.
          </p>
        ) : (
          <FeatureListingForm
            listings={activeListings}
            plans={plans.map((p) => ({
              id: p.id,
              name: p.name,
              durationDays: p.durationDays,
              price: Number(p.price),
              currency: p.currency,
            }))}
            mpesaConfigured={isMpesaConfigured()}
            preselectedListingId={listingId}
          />
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Your subscriptions</h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No featured subscriptions yet.
        </p>
      ) : (
        <SubscriptionHistory subscriptions={rows} isDev={process.env.NODE_ENV !== "production"} />
      )}
    </div>
  );
}

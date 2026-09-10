import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPublicListings, getMakeModelIndex } from "@/server/services/listing-service";
import { getMyFavoriteListingIds } from "@/server/services/favorite-service";
import { CarCard } from "@/components/listings/CarCard";
import { HeroSearchBar } from "@/components/home/HeroSearchBar";
import { StickySearchBar } from "@/components/home/StickySearchBar";
import { BecomeSellerButton } from "@/components/auth/BecomeSellerButton";
import { siteConfig } from "@/config/site";

const HERO_SECONDARY_BUTTON_CLASS =
  "rounded-md bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 backdrop-blur-sm transition hover:bg-white/20";

export const metadata = {
  title: "Home",
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

// How many listings to tease on the homepage before sending the visitor to
// the full /cars browse experience (filters, sort, pagination) — this page
// stays a simple preview, not a second copy of that page.
const HOME_LISTING_COUNT = 8;

// The marketing landing page — "/" used to just redirect straight to /cars
// (no homepage had been designed yet). Deliberately thin: a hero banner
// then a preview of live listings, both pointing into the same /cars page
// the header nav already exposes — this isn't a second source of truth for
// site structure, just a front door onto it.
export default async function HomePage() {
  const session = await auth();
  const [{ listings, totalCount }, makeModelIndex, favoriteIds] = await Promise.all([
    getPublicListings({ sort: "featured", page: 1 }),
    getMakeModelIndex(),
    session?.user ? getMyFavoriteListingIds() : Promise.resolve(new Set<string>()),
  ]);
  const featuredListings = listings.slice(0, HOME_LISTING_COUNT);

  return (
    <div>
      {/* Flush against the header (no gap) and sticky the same way the
          header is — top offset matches UtilityBar + header's combined
          rendered height (42px utility bar + 52px header) so the two sit
          seamlessly stacked both at rest and while scrolled. Lives outside
          the hero's own overflow-hidden section so it keeps sticking past
          the hero, all the way through the listings below. Auto-hides on
          scroll down / reappears on scroll up (see StickySearchBar) rather
          than staying permanently visible like the header above it — the
          header is a handful of persistent nav links, this is a big search
          card that's worth reclaiming screen space from while browsing. */}
      <StickySearchBar>
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="mx-auto w-full max-w-4xl">
            <HeroSearchBar makeModelIndex={makeModelIndex} />
          </div>
        </div>
      </StickySearchBar>

      <section className="relative w-full overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/home/hero.png"
            alt="A car ready for sale outside a dealership showroom at dusk"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto flex h-[62vh] max-h-[640px] min-h-[420px] w-full max-w-6xl flex-col justify-end px-4 pb-10 sm:pb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold uppercase tracking-wide text-white sm:text-lg">
            Kenya&apos;s trusted car marketplace
          </span>
          <h1 className="mt-4 max-w-xl text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Find your next car, or sell the one you have
          </h1>
          <p className="mt-3 max-w-lg text-sm text-white/80 sm:text-base">
            Verified listings, trusted sellers, and dealership-grade services — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/cars"
              className="rounded-md bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-accent/90"
            >
              Browse Vehicles
            </Link>
            {/* Same "Sell a Car" destination/role logic as the header nav
                (HeaderNav.tsx) — a signed-in seller/admin/moderator goes
                straight to the listing form, a signed-in buyer upgrades to
                seller first (a real mutation, hence the form submit rather
                than a plain link), and a signed-out visitor logs in first. */}
            {session?.user ? (
              session.user.role === "SELLER" ||
              session.user.role === "ADMIN" ||
              session.user.role === "MODERATOR" ? (
                <Link href="/dashboard/listings/new" className={HERO_SECONDARY_BUTTON_CLASS}>
                  List Your Car
                </Link>
              ) : (
                <BecomeSellerButton
                  redirectTo="/dashboard/listings/new"
                  label="List Your Car"
                  pendingLabel="Setting up…"
                  className={HERO_SECONDARY_BUTTON_CLASS}
                />
              )
            ) : (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent("/account?autoSeller=1")}`}
                className={HERO_SECONDARY_BUTTON_CLASS}
              >
                List Your Car
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Browse Vehicles</h2>
            <p className="mt-1 text-sm text-slate-600">
              {totalCount.toLocaleString()} verified {totalCount === 1 ? "listing" : "listings"} available right now.
            </p>
          </div>
          <Link href="/cars" className="text-sm font-semibold text-brand hover:underline">
            View all vehicles →
          </Link>
        </div>

        {featuredListings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="font-medium text-slate-700">No vehicles listed yet.</p>
            <p className="mt-1 text-sm text-slate-500">Check back soon — new listings are added regularly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredListings.map((listing) => (
              <CarCard
                key={listing.id}
                listing={listing}
                isFavorited={favoriteIds.has(listing.id)}
                isAuthenticated={Boolean(session?.user)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

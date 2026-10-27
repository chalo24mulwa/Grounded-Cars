import { preload } from "react-dom";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPublicListings, getMakeModelIndex } from "@/server/services/listing-service";
import { getMyFavoriteListingIds } from "@/server/services/favorite-service";
import { CarCard } from "@/components/listings/CarCard";
import { Pagination } from "@/components/listings/Pagination";
import { HeroSearchBar } from "@/components/home/HeroSearchBar";
import { StickySearchBar } from "@/components/home/StickySearchBar";
import { BecomeSellerButton } from "@/components/auth/BecomeSellerButton";
import { siteConfig } from "@/config/site";
import { buildHomepageJsonLd, serializeJsonLd } from "@/lib/structured-data";
import type { Metadata } from "next";

const HERO_SECONDARY_BUTTON_CLASS =
  "rounded-md bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 backdrop-blur-sm transition hover:bg-white/20";

// `title.absolute` opts out of the root layout's `template: "%s | Car
// Marketplace"` (see layout.tsx) — the homepage's title starts with the brand
// ("Car Marketplace | Buy & Sell Cars in Kenya"), never "Home | Car
// Marketplace". The Open Graph and Twitter blocks are declared here in full
// (a page's `openGraph` replaces the layout's rather than merging with it).
const HOME_URL = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/`;

// NOTE: no `alternates.canonical` and no `openGraph.url` here on purpose. Next's
// metadata API always prints the root URL without its trailing slash
// ("https://carmarketplace.co.ke"); the two are the same URL, but the intended
// canonical is the explicit "https://carmarketplace.co.ke/", so those two tags
// are rendered by hand in the page below — each exactly once, and nowhere else.
export const metadata: Metadata = {
  title: { absolute: siteConfig.homeTitle },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.homeTitle,
    description: siteConfig.description,
    locale: "en_KE",
    images: [siteConfig.shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.homeTitle,
    description: siteConfig.description,
    images: [siteConfig.shareImage.url],
  },
};

// The homepage lists cars 48 per page (the same page size as /cars), with
// page links underneath once there are more than 48: /?page=2, /?page=3 …
function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

// The marketing landing page — "/" used to just redirect straight to /cars
// (no homepage had been designed yet). Deliberately thin: a hero banner
// then a preview of live listings, both pointing into the same /cars page
// the header nav already exposes — this isn't a second source of truth for
// site structure, just a front door onto it.
const HERO_SRC = "/images/home/hero-1080.webp";
const HERO_SRCSET =
  "/images/home/hero-640.webp 640w, /images/home/hero-1080.webp 1080w, /images/home/hero-1600.webp 1600w";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requestedPage = parsePage((await searchParams).page);
  // Starts the hero download from the <head>, before the browser reaches the
  // <img> further down the HTML.
  preload(HERO_SRC, { as: "image", imageSrcSet: HERO_SRCSET, imageSizes: "100vw", fetchPriority: "high" });
  const session = await auth();
  const [{ listings, totalCount, page, totalPages }, makeModelIndex, favoriteIds] = await Promise.all([
    getPublicListings({ sort: "featured", page: requestedPage }),
    getMakeModelIndex(),
    session?.user ? getMyFavoriteListingIds() : Promise.resolve(new Set<string>()),
  ]);
  const featuredListings = listings;

  return (
    <div>
      {/* The site's single, authoritative Organization + WebSite structured
          data (see lib/structured-data.ts) — server-rendered here so it's in
          the HTML a crawler receives, and declared nowhere else. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- static site facts only, escaped by serializeJsonLd
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildHomepageJsonLd()) }}
      />

      {/* The homepage's canonical URL and og:url, with the trailing slash (see
          the note above `metadata`). React 19 hoists these into <head>. */}
      <link rel="canonical" href={HOME_URL} />
      <meta property="og:url" content={HOME_URL} />

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
          {/* Pre-sized WebP files (made from hero.jpg) served straight from
              public/ by the web server — the image optimizer is skipped for
              the page's largest element, so it no longer waits on the Node
              process or on the optimizer's cache, which is wiped on every
              deploy. Preloaded with high priority above. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_SRC}
            srcSet={HERO_SRCSET}
            sizes="100vw"
            alt="A yard of grounded, salvage, and damaged vehicles at dusk"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto flex h-[62vh] max-h-[640px] min-h-[420px] w-full max-w-6xl flex-col justify-end px-4 pb-10 sm:pb-14">
          {/* The page's one H1 states the brand in plain, visible text: the
              site name leads (in the same eyebrow styling this line always
              had) and the existing headline follows, so search engines read
              "Car Marketplace Kenya — Find your next car, or sell the one you
              have" as the page's main heading. */}
          <h1 className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold uppercase tracking-wide text-white sm:text-lg">
              {siteConfig.alternateName}
            </span>
            <span className="mt-4 block text-3xl font-bold text-white sm:text-4xl md:text-5xl">
              Find your next car, or sell the one you have
            </span>
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

      <section id="listings" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12">
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
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
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => (p === 1 ? "/#listings" : `/?page=${p}#listings`)}
        />
      </section>
    </div>
  );
}

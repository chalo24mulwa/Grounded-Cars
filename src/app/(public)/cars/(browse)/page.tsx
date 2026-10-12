import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPublicListings, getMakeModelIndex } from "@/server/services/listing-service";
import { getMyFavoriteListingIds } from "@/server/services/favorite-service";
import { parseListingSearchParams, type ListingSearchParams } from "@/server/validation/search-schema";
import { CarCard } from "@/components/listings/CarCard";
import { SearchFilterSidebar } from "@/components/listings/SearchFilterSidebar";
import { SortSelect } from "@/components/listings/SortSelect";
import { Pagination } from "@/components/listings/Pagination";
import { ActiveFilterChips } from "@/components/listings/ActiveFilterChips";

// Canonical always points at the bare, unfiltered URL — every filter/sort/
// page combination is a view of the same underlying page as far as search
// engines should be concerned, not a separate indexable page (standard
// practice for faceted/filtered browse pages; avoids duplicate-content
// dilution across the near-infinite set of possible query-string
// combinations).
export const metadata = {
  title: "Browse Vehicles",
  description: "Browse verified cars for sale across Kenya — filter by make, model, price, and location.",
  alternates: { canonical: "/cars" },
};

// Search/filter/sort/pagination all live here as URL state (parsed safely
// by parseListingSearchParams — see that file for why a bad param can
// never break the whole query) and the actual query lives in
// getPublicListings() (listing-service.ts). This page stays a thin
// Server Component: parse → fetch → render, no business logic of its own.
//
// Lives inside the (browse) route group (still served at /cars — route
// groups never affect the URL) specifically so this page's own
// loading.tsx doesn't also wrap the sibling cars/[slug] route — see that
// loading.tsx's comment for the soft-404 bug this avoids.
export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = parseListingSearchParams(raw);

  const session = await auth();

  const [{ listings, page, totalPages, totalCount }, makeModelIndex, favoriteIds] = await Promise.all([
    getPublicListings(filters),
    getMakeModelIndex(),
    session?.user ? getMyFavoriteListingIds() : Promise.resolve(new Set<string>()),
  ]);

  function buildHref(overrides: Partial<Record<keyof ListingSearchParams, string | number | undefined>>) {
    const merged: Record<string, unknown> = { ...filters, ...overrides };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value == null || value === "") continue;
      if (key === "sort" && value === "featured") continue; // default — omit for a cleaner URL
      if (key === "page" && value === 1) continue; // default — omit
      params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/cars?${qs}` : "/cars";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">Browse Vehicles</h1>

      {/* Real <a> links into each make's own landing page — internal
          linking the spec asks for, reachable without any JS, and reuses
          makeModelIndex already fetched above for the filter sidebar (no
          extra query). Only ever lists makes that currently have listings,
          same rule the pages themselves and the sitemap enforce. */}
      {makeModelIndex.length > 0 && (
        <nav aria-label="Shop by make" className="mb-6 flex flex-wrap justify-center gap-2">
          {makeModelIndex.map(({ make }) => (
            <Link
              key={make}
              href={`/cars/${encodeURIComponent(make.toLowerCase())}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand/40 hover:text-brand"
            >
              {make}
            </Link>
          ))}
        </nav>
      )}

      {/* min-h guarantees genuine travel room below the sidebar's own
          (capped) height, so the sticky sidebar has room to actually
          demonstrate itself even when the listings column is shorter than
          the sidebar (e.g. very few results) — without this, position:
          sticky has zero space to operate in and silently behaves like
          static positioning. It has to clear the sidebar's own max-height
          (100vh-143px) by a real margin, not just match ~100vh, otherwise
          there's still no slack. max-h + overflow-y-auto on the aside
          itself is the companion fix: keeps the whole filter panel within
          the viewport (with its own scrollbar if needed) instead of ever
          overflowing past the bottom of the screen once stuck. */}
      <div className="flex flex-col gap-6 lg:min-h-[calc(100vh+100px)] lg:flex-row">
        <aside className="hidden lg:sticky lg:top-[127px] lg:block lg:max-h-[calc(100vh-143px)] lg:w-72 lg:shrink-0 lg:self-start lg:overflow-y-auto">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Filters</h2>
          <SearchFilterSidebar makeModelIndex={makeModelIndex} current={filters} />
        </aside>

        {/* Mobile: the exact same filter form, collapsed behind a native
            <details> disclosure — no client JS needed just to show/hide it. */}
        <details className="rounded-xl border border-slate-200 bg-white lg:hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900">
            Filters
          </summary>
          <div className="border-t border-slate-200 p-4">
            <SearchFilterSidebar makeModelIndex={makeModelIndex} current={filters} />
          </div>
        </details>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {totalCount.toLocaleString()} {totalCount === 1 ? "vehicle" : "vehicles"} found
            </p>
            <SortSelect current={filters.sort} />
          </div>

          <ActiveFilterChips
            current={filters}
            buildHrefWithout={(key) => buildHref({ [key]: undefined })}
          />

          {listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="font-medium text-slate-700">No vehicles match your search.</p>
              <p className="mt-1 text-sm text-slate-500">
                Try widening your filters or clearing them.
              </p>
              <Link
                href="/cars"
                className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing, i) => (
                <CarCard
                  key={listing.id}
                  listing={listing}
                  isFavorited={favoriteIds.has(listing.id)}
                  isAuthenticated={Boolean(session?.user)}
                  priority={i < 2}
                />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} buildHref={(p) => buildHref({ page: p })} />
        </div>
      </div>
    </div>
  );
}

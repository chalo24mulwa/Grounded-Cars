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

export const metadata = {
  title: "Best Deals",
  description: "Featured, verified cars for sale across Kenya — hand-picked top placements updated daily.",
  alternates: { canonical: "/best-deals" },
};

// Same filter/sort/pagination shell as /cars (see that page for the
// reasoning), scoped down to onlyFeatured: true — a listing that's since
// been marked SOLD or whose subscription lapsed simply stops appearing
// here on the very next request, no separate cleanup step needed.
export default async function BestDealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = parseListingSearchParams(raw);

  const session = await auth();

  const [{ listings, page, totalPages, totalCount }, makeModelIndex, favoriteIds] = await Promise.all([
    getPublicListings({ ...filters, onlyFeatured: true }),
    getMakeModelIndex(),
    session?.user ? getMyFavoriteListingIds() : Promise.resolve(new Set<string>()),
  ]);

  function buildHref(overrides: Partial<Record<keyof ListingSearchParams, string | number | undefined>>) {
    const merged: Record<string, unknown> = { ...filters, ...overrides };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value == null || value === "") continue;
      if (key === "sort" && value === "featured") continue;
      if (key === "page" && value === 1) continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/best-deals?${qs}` : "/best-deals";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-1 text-center text-2xl font-bold">Best Deals</h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        {totalCount.toLocaleString()} verified, featured listing{totalCount === 1 ? "" : "s"} from
        our sellers.
      </p>

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
          <SearchFilterSidebar makeModelIndex={makeModelIndex} current={filters} basePath="/best-deals" />
        </aside>

        {/* Mobile: the exact same filter form, collapsed behind a native
            <details> disclosure — no client JS needed just to show/hide it. */}
        <details className="rounded-xl border border-slate-200 bg-white lg:hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900">
            Filters
          </summary>
          <div className="border-t border-slate-200 p-4">
            <SearchFilterSidebar makeModelIndex={makeModelIndex} current={filters} basePath="/best-deals" />
          </div>
        </details>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <SortSelect current={filters.sort} basePath="/best-deals" />
          </div>

          <ActiveFilterChips
            current={filters}
            buildHrefWithout={(key) => buildHref({ [key]: undefined })}
            basePath="/best-deals"
          />

          {listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="font-medium text-slate-700">No featured listings match your search.</p>
              <p className="mt-1 text-sm text-slate-500">Try widening your filters or clearing them.</p>
              <Link
                href="/best-deals"
                className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <CarCard
                  key={listing.id}
                  listing={listing}
                  isFavorited={favoriteIds.has(listing.id)}
                  isAuthenticated={Boolean(session?.user)}
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

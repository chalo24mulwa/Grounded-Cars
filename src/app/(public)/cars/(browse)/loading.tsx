// Next.js's route-level loading convention — shown automatically while the
// page's data fetch (search/filter/sort against the DB) is in flight, e.g.
// right after submitting a filter change. No custom spinner wiring needed.
//
// Deliberately lives inside the (browse) route group, not directly under
// cars/, so it scopes to ONLY this page (served at /cars, since route
// groups don't affect the URL) — a loading.tsx placed directly in cars/
// would also wrap the sibling cars/[slug] route (listing detail + the
// make-browse pages), and confirmed the hard way that wrapping a page
// which can call notFound() in an automatic Suspense boundary makes Next
// stream a 200-status shell before the page's own not-found status can
// take effect (a "soft 404" — the wrong page content stops showing, but
// the HTTP status stays 200, which is exactly what Google Search Console
// flags as an indexing error). /cars/[slug] has no loading.tsx of its own
// for this same reason.
export default function CarsLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
      <div className="mb-6 h-8 w-56 rounded bg-slate-200" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="hidden h-[600px] w-72 shrink-0 rounded-xl bg-slate-100 lg:block" />
        <div className="min-w-0 flex-1">
          <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="aspect-[4/3] w-full bg-slate-200" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

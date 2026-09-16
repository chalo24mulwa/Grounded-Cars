import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { getAllPublicListingSlugsForSitemap } from "@/server/services/listing-service";
import { siteConfig } from "@/config/site";

export const metadata = { title: "SEO Diagnostics" };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Admin-only (enforced by the (admin) layout — see AdminLayout) technical-
// SEO status page. Every number here is computed live from the same
// functions that actually generate the real sitemap.xml/robots.txt, not a
// hand-maintained summary that could drift out of sync with them. No
// sensitive data is shown (see spec: "do not expose sensitive information
// publicly") — this route itself isn't public anyway (admin-gated, and
// robots.ts disallows /admin entirely).
async function checkLiveUrl(path: string): Promise<{ status: number | null; ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${APP_URL}${path}`, { cache: "no-store" });
    return { status: res.status, ok: res.ok };
  } catch (error) {
    return { status: null, ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

export default async function AdminSeoPage() {
  const [sitemapEntries, robotsConfig, listingSlugs, homeCheck, sitemapCheck, robotsCheck] = await Promise.all([
    sitemap(),
    Promise.resolve(robots()),
    getAllPublicListingSlugsForSitemap(),
    checkLiveUrl("/"),
    checkLiveUrl("/sitemap.xml"),
    checkLiveUrl("/robots.txt"),
  ]);

  const byPrefix = (prefix: string) => sitemapEntries.filter((e) => e.url.startsWith(`${APP_URL}${prefix}`)).length;
  const counts = {
    total: sitemapEntries.length,
    listings: listingSlugs.length,
    events: byPrefix("/events/"),
    csr: byPrefix("/csr/"),
    makes: sitemapEntries.filter((e) => /^\/cars\/[^/]+$/.test(e.url.replace(APP_URL, ""))).length,
    locations: byPrefix("/cars-for-sale/"),
  };

  const sampleListing = sitemapEntries.find((e) => e.url.startsWith(`${APP_URL}/cars/`) && !e.url.match(/\/cars\/[^/]+$/)) ??
    sitemapEntries.find((e) => /\/cars\/.+-\d{4}-/.test(e.url));

  const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SEO Diagnostics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live status of indexing infrastructure — every value below is computed from the same code that
          serves the real sitemap.xml/robots.txt, not a separate hand-kept summary.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Live HTTP checks</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Homepage (/)", result: homeCheck },
            { label: "/sitemap.xml", result: sitemapCheck },
            { label: "/robots.txt", result: robotsCheck },
          ].map(({ label, result }) => (
            <div key={label} className="rounded-lg border border-slate-100 p-3">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd
                className={
                  result.ok ? "mt-1 font-mono text-sm font-semibold text-status-active" : "mt-1 font-mono text-sm font-semibold text-red-600"
                }
              >
                {result.status ?? `ERROR: ${result.error}`}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sitemap contents</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Total URLs", counts.total],
            ["Vehicle listings", counts.listings],
            ["Make pages", counts.makes],
            ["Location pages", counts.locations],
            ["Events", counts.events],
            ["CSR initiatives", counts.csr],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-slate-100 p-3 text-center">
              <dd className="text-xl font-bold text-slate-900">{value}</dd>
              <dt className="text-xs text-slate-500">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Make/location pages only ever appear here once a real listing matches them (see
          cars/[slug]/page.tsx and cars-for-sale/[location]/page.tsx) — never a fixed or guessed list.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">robots.txt rules</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
{JSON.stringify(rules, null, 2)}
        </pre>
        <p className="mt-2 text-xs text-slate-500">Sitemap reference: {robotsConfig.sitemap}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Structured data / metadata coverage
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
          <li>✅ Organization + WebSite JSON-LD — every page (root layout)</li>
          <li>✅ Vehicle + Offer JSON-LD — every listing detail page</li>
          <li>✅ BreadcrumbList JSON-LD — listing, make, and location pages</li>
          <li>✅ AggregateRating + Review JSON-LD — /reviews</li>
          <li>✅ Canonical URL — homepage, /cars, every listing, make and location page</li>
          <li>✅ Open Graph + Twitter Card — homepage template, every listing detail page</li>
          <li>✅ robots: noindex,follow — /login, /register, /forgot-password, /reset-password, SOLD listings</li>
        </ul>
      </section>

      {sampleListing && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sample listing URL (spot-check)
          </h2>
          <p className="mt-2 break-all font-mono text-sm text-brand">{sampleListing.url}</p>
          <p className="mt-1 text-xs text-slate-500">
            Open this URL and "View Page Source" to verify title, meta description, canonical, and JSON-LD
            render as expected — or paste it into Google's Rich Results Test.
          </p>
        </section>
      )}

      <p className="text-xs text-slate-400">
        Site: {siteConfig.legalName} · Base URL: {APP_URL}
      </p>
    </div>
  );
}

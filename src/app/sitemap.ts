import type { MetadataRoute } from "next";
import {
  getAllPublicListingSlugsForSitemap,
  getMakeModelIndex,
  getDistinctLocations,
} from "@/server/services/listing-service";
import { getPublishedEvents } from "@/server/services/event-service";
import { getPublishedCsrInitiatives } from "@/server/services/csr-service";
import { eventPath } from "@/lib/event-utils";

// Regenerated at most every 10 minutes. Without this, Next.js builds the sitemap
// once, at build time, and serves that copy until the next deploy — so a newly
// published event or car would stay out of it (and out of Google's sight) for
// as long as the site went without a redeploy.
export const revalidate = 600;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const SERVICE_SLUGS = [
  "pre-purchase-inspection",
  "car-financing",
  "car-valuation",
  "car-tracking",
  "home-repairs",
  "car-insurance",
];

// Static marketing/browse pages + every publicly-visible listing (ACTIVE,
// and SOLD while SHOW_SOLD_LISTINGS_PUBLICLY stays true — see
// listing-service.ts) + every published event. Auth-gated routes are never
// listed here; robots.ts also explicitly disallows crawling them.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, events, csrInitiatives, makeIndex, locations] = await Promise.all([
    getAllPublicListingSlugsForSitemap(),
    getPublishedEvents(),
    getPublishedCsrInitiatives(),
    getMakeModelIndex(),
    getDistinctLocations(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/about-us`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/cars`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/best-deals`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${APP_URL}/events`, changeFrequency: "daily", priority: 0.6 },
    { url: `${APP_URL}/csr`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${APP_URL}/reviews`, changeFrequency: "weekly", priority: 0.5 },
    ...SERVICE_SLUGS.map(
      (slug): MetadataRoute.Sitemap[number] => ({
        url: `${APP_URL}/services/${slug}`,
        changeFrequency: "monthly",
        priority: 0.5,
      })
    ),
  ];

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${APP_URL}/cars/${listing.slug}`,
    lastModified: listing.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const eventEntries: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${APP_URL}${eventPath(event)}`,
    lastModified: event.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const csrEntries: MetadataRoute.Sitemap = csrInitiatives.map((initiative) => ({
    url: `${APP_URL}/csr/${initiative.slug}`,
    lastModified: initiative.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  // Make and location landing pages — only ever included once real
  // listings exist for them (see cars/[slug]/page.tsx's MakeBrowsePage and
  // cars-for-sale/[location]/page.tsx), never a fixed/guessed list. This is
  // what keeps the sitemap from ever advertising a thin, listing-free page.
  const makeEntries: MetadataRoute.Sitemap = makeIndex.map(({ make }) => ({
    url: `${APP_URL}/cars/${encodeURIComponent(make.toLowerCase())}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const locationEntries: MetadataRoute.Sitemap = locations.map((location) => ({
    url: `${APP_URL}/cars-for-sale/${encodeURIComponent(location.toLowerCase())}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...listingEntries, ...eventEntries, ...csrEntries, ...makeEntries, ...locationEntries];
}

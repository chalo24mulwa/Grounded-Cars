import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getPublicListings, getDistinctLocations } from "@/server/services/listing-service";
import { getMyFavoriteListingIds } from "@/server/services/favorite-service";
import { CarCard } from "@/components/listings/CarCard";
import { siteConfig } from "@/config/site";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// A location landing page only exists at all once a real listing actually
// names it — matching against getDistinctLocations() (never a fixed,
// hardcoded list of Kenyan towns) is what keeps this from ever becoming a
// "thousands of thin pages" generator: no listings for "eldoret" today
// means no /cars-for-sale/eldoret page today, full stop, and the sitemap
// (see sitemap.ts) only lists the ones that currently resolve.
async function findMatchingLocation(param: string): Promise<string | null> {
  const locations = await getDistinctLocations();
  const decoded = decodeURIComponent(param).toLowerCase();
  return locations.find((location) => location.toLowerCase() === decoded) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ location: string }>;
}): Promise<Metadata> {
  const { location: param } = await params;
  const location = await findMatchingLocation(param);
  if (!location) return {};

  const title = `Cars for Sale in ${location} | ${siteConfig.legalName}`;
  return {
    title: { absolute: title },
    description: `Browse verified cars for sale in ${location}, Kenya — locally used vehicles and fresh imports from sellers and dealers on ${siteConfig.name}.`,
    alternates: { canonical: `${APP_URL}/cars-for-sale/${encodeURIComponent(param.toLowerCase())}` },
  };
}

export default async function CarsForSaleLocationPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location: param } = await params;
  const location = await findMatchingLocation(param);
  if (!location) notFound();

  const session = await auth();
  const [{ listings, totalCount }, favoriteIds] = await Promise.all([
    getPublicListings({ location }),
    session?.user ? getMyFavoriteListingIds() : Promise.resolve(new Set<string>()),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Cars", item: `${APP_URL}/cars` },
      { "@type": "ListItem", position: 3, name: `Cars for Sale in ${location}` },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- static breadcrumb data only
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/cars" className="hover:text-brand hover:underline">
              Cars
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-slate-700" aria-current="page">
            {location}
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Cars for Sale in {location}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {totalCount.toLocaleString()} verified {totalCount === 1 ? "listing" : "listings"} in {location} right
        now.
      </p>

      {listings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="font-medium text-slate-700">No vehicles currently listed in {location}.</p>
          <Link href="/cars" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            Browse all vehicles →
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      <p className="mt-8 text-sm text-slate-500">
        Looking elsewhere?{" "}
        <Link href="/cars" className="font-medium text-brand hover:underline">
          Browse all vehicles across Kenya
        </Link>
        .
      </p>
    </div>
  );
}

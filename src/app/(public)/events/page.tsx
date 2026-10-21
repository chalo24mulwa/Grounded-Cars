import Link from "next/link";
import type { Metadata } from "next";
import { UploadedImage } from "@/components/ui/UploadedImage";
import { getPublishedEvents } from "@/server/services/event-service";
import { siteConfig } from "@/config/site";
import { serializeJsonLd } from "@/lib/structured-data";
import {
  describeEventDate,
  eventPath,
  eventStartIso,
  formatEventDate,
  formatEventTime,
  groupEventsByTime,
} from "@/lib/event-utils";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const TITLE = "Car Events & Shows in Kenya";
const DESCRIPTION =
  "Upcoming car shows, dealer days and promotions in Kenya from Car Marketplace — with the date, time and location of each event, and past events listed below.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/events" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${TITLE} | ${siteConfig.name}`,
    description: DESCRIPTION,
    url: `${APP_URL}/events`,
    images: [siteConfig.shareImage],
  },
};

type EventRow = Awaited<ReturnType<typeof getPublishedEvents>>[number];

function EventCard({ event, past }: { event: EventRow; past: boolean }) {
  const when = event.eventDate ? describeEventDate(event.eventDate) : null;

  return (
    <Link
      href={eventPath(event)}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        {event.imageUrl ? (
          <UploadedImage
            src={event.imageUrl}
            alt={event.title}
            fill
            className={`object-cover transition group-hover:scale-[1.02] ${past ? "grayscale-[40%]" : ""}`}
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Car Marketplace</div>
        )}
        {past && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2.5 py-0.5 text-xs font-semibold text-white">
            Past event
          </span>
        )}
      </div>
      <div className="p-4">
        {when && event.eventDate && (
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">
            <time dateTime={eventStartIso(event.eventDate)}>
              {formatEventDate(when.dateKey, "short")}
              {when.time ? ` · ${formatEventTime(when.time)}` : ""}
            </time>
          </p>
        )}
        <h3 className="mt-1 font-semibold text-slate-900">{event.title}</h3>
        {event.location && <p className="mt-0.5 text-sm text-slate-500">{event.location}</p>}
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p>
      </div>
    </Link>
  );
}

export default async function EventsPage() {
  const { upcoming, past } = groupEventsByTime(await getPublishedEvents());
  const hasAny = upcoming.length + past.length > 0;

  // A plain list of the real event pages shown below, in the order shown.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    itemListElement: [...upcoming, ...past].map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: event.title,
      url: `${APP_URL}${eventPath(event)}`,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {hasAny && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- built from our own data, escaped by serializeJsonLd
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
        />
      )}

      <h1 className="text-2xl font-bold text-slate-900">{TITLE}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Car shows, dealer days, and promotions happening around the marketplace.
      </p>

      {!hasAny ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="font-medium text-slate-700">No events scheduled right now.</p>
          <p className="mt-1 text-sm text-slate-500">Check back soon.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="upcoming-events" className="mt-8">
            <h2 id="upcoming-events" className="text-xl font-bold text-slate-900">
              Upcoming events
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No upcoming events are scheduled right now — check back soon.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} past={false} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="past-events" className="mt-12">
              <h2 id="past-events" className="text-xl font-bold text-slate-900">
                Past events
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} past />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

import { cache } from "react";
import { UploadedImage } from "@/components/ui/UploadedImage";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedEventById } from "@/server/services/event-service";
import { siteConfig } from "@/config/site";
import { serializeJsonLd } from "@/lib/structured-data";
import {
  describeEventDate,
  eventIdFromParam,
  eventPath,
  eventStartIso,
  formatEventDate,
  formatEventTime,
  groupEventsByTime,
} from "@/lib/event-utils";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// The folder is still [id] (so existing routing is untouched), but the segment
// is now "<title-words>-<id>". Both the metadata and the page need the event;
// cache() makes that one query per request instead of two.
const loadEvent = cache((param: string) => getPublishedEventById(eventIdFromParam(param)));

function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${APP_URL}${url}`;
}

function whenText(eventDate: Date | null): { date: string; time: string | null; dateKey: string } | null {
  if (!eventDate) return null;
  const when = describeEventDate(eventDate);
  return {
    dateKey: when.dateKey,
    date: formatEventDate(when.dateKey, "long"),
    time: when.time ? formatEventTime(when.time) : null,
  };
}

function buildDescription(event: { description: string; location: string | null; eventDate: Date | null }): string {
  const when = whenText(event.eventDate);
  const facts = [when ? `${when.date}${when.time ? ` at ${when.time}` : ""}` : null, event.location].filter(Boolean).join(" · ");
  const body = event.description.replace(/\s+/g, " ").trim();
  const text = facts ? `${facts}. ${body}` : body;
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: param } = await params;
  const event = await loadEvent(param);
  if (!event) return {};

  const when = whenText(event.eventDate);
  // Unique per event: the title plus the date and place, which is what a
  // searcher looking for "<event> <date>" actually types.
  const title = [event.title, when ? formatEventDate(when.dateKey, "short") : null].filter(Boolean).join(" – ");
  const description = buildDescription(event);
  const canonical = eventPath(event);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: `${title} | ${siteConfig.name}`,
      description,
      url: `${APP_URL}${canonical}`,
      images: event.imageUrl ? [{ url: event.imageUrl, alt: event.title }] : [siteConfig.shareImage],
    },
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const event = await loadEvent(param);
  if (!event) notFound();

  // Old links (/events/<id>) and any non-canonical spelling go to the one
  // canonical URL permanently, so already-indexed addresses keep working and
  // search engines consolidate on a single URL per event.
  const canonicalPath = eventPath(event);
  if (`/events/${param}` !== canonicalPath) permanentRedirect(canonicalPath);

  const when = whenText(event.eventDate);
  const isPast = event.eventDate ? groupEventsByTime([event]).past.length > 0 : false;
  // Browsers submit textarea line breaks as "\r\n", so those are normalised
  // before splitting on blank lines into paragraphs.
  const paragraphs = event.description
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Event structured data only describes what the page shows: it is skipped
  // for an event with no date (Google requires a start date, and inventing one
  // would be wrong), and location/image only appear when they exist.
  const eventJsonLd = event.eventDate
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        description: event.description.replace(/\s+/g, " ").trim().slice(0, 500),
        startDate: eventStartIso(event.eventDate),
        eventStatus: "https://schema.org/EventScheduled",
        url: `${APP_URL}${canonicalPath}`,
        ...(event.location ? { location: { "@type": "Place", name: event.location, address: event.location } } : {}),
        ...(event.imageUrl ? { image: [absoluteUrl(event.imageUrl)] } : {}),
        organizer: { "@type": "Organization", name: siteConfig.name, url: `${APP_URL}/` },
      }
    : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${APP_URL}/` },
      { "@type": "ListItem", position: 2, name: "Events", item: `${APP_URL}/events` },
      { "@type": "ListItem", position: 3, name: event.title },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {eventJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- built from our own data, escaped by serializeJsonLd
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(eventJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- built from our own data, escaped by serializeJsonLd
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/events" className="hover:text-brand hover:underline">
              Events
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-slate-700" aria-current="page">
            {event.title}
          </li>
        </ol>
      </nav>

      <div className="mt-4 relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {event.imageUrl ? (
          <UploadedImage src={event.imageUrl} alt={event.title} fill className="object-cover" sizes="768px" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">Grounded Cars</div>
        )}
      </div>

      <article className="mt-6">
        {isPast && (
          <span className="inline-block rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">
            Past event
          </span>
        )}
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{event.title}</h1>

        {(when || event.location) && (
          <dl className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
            {when && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  <time dateTime={event.eventDate ? eventStartIso(event.eventDate) : undefined}>{when.date}</time>
                </dd>
              </div>
            )}
            {when?.time && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {when.time} <span className="text-sm font-normal text-slate-500">(EAT)</span>
                </dd>
              </div>
            )}
            {event.location && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{event.location}</dd>
              </div>
            )}
          </dl>
        )}

        <h2 className="mt-8 text-lg font-semibold text-slate-900">About this event</h2>
        <div className="mt-2 space-y-4 leading-relaxed text-slate-700">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      </article>

      <div className="mt-10 border-t border-slate-200 pt-6">
        <Link href="/events" className="text-sm font-medium text-brand hover:underline">
          ← All events
        </Link>
      </div>
    </div>
  );
}

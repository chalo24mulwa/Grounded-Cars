import Link from "next/link";
import Image from "next/image";
import { getPublishedEvents } from "@/server/services/event-service";

export const metadata = {
  title: "Events",
  description: "Upcoming car shows, dealer days, and promotions from Car Marketplace.",
  alternates: { canonical: "/events" },
};

export default async function EventsPage() {
  const events = await getPublishedEvents();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Events</h1>
      <p className="mt-1 text-sm text-slate-500">
        Car shows, dealer days, and promotions happening around the marketplace.
      </p>

      {events.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="font-medium text-slate-700">No events scheduled right now.</p>
          <p className="mt-1 text-sm text-slate-500">Check back soon.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-[16/10] w-full bg-slate-100">
                {event.imageUrl ? (
                  <Image
                    src={event.imageUrl}
                    alt={event.title}
                    fill
                    unoptimized
                    className="object-cover transition group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Car Marketplace
                  </div>
                )}
              </div>
              <div className="p-4">
                {event.eventDate && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">
                    {event.eventDate.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
                <h2 className="mt-1 font-semibold text-slate-900">{event.title}</h2>
                {event.location && <p className="mt-0.5 text-sm text-slate-500">{event.location}</p>}
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

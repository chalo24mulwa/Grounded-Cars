import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedEventById } from "@/server/services/event-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublishedEventById(id);
  if (!event) return {};

  const description = event.description.length > 160 ? `${event.description.slice(0, 157)}...` : event.description;
  return {
    title: event.title,
    description,
    alternates: { canonical: `/events/${event.id}` },
    openGraph: {
      title: event.title,
      description,
      images: event.imageUrl ? [{ url: event.imageUrl }] : undefined,
    },
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getPublishedEventById(id);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/events" className="text-sm font-medium text-brand hover:underline">
        ← All events
      </Link>

      <div className="mt-4 relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {event.imageUrl ? (
          <Image src={event.imageUrl} alt={event.title} fill unoptimized className="object-cover" sizes="768px" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">Car Marketplace</div>
        )}
      </div>

      <div className="mt-6">
        {event.eventDate && (
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
            {event.eventDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{event.title}</h1>
        {event.location && <p className="mt-1 text-slate-500">{event.location}</p>}

        <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-700">{event.description}</p>
      </div>
    </div>
  );
}

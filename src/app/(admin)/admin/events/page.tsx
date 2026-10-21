import Link from "next/link";
import { getAllEventsForAdmin } from "@/server/services/event-service";
import { Pagination } from "@/components/listings/Pagination";
import { EventPublishToggle } from "@/components/admin/EventPublishToggle";
import { describeEventDate, formatEventDate, formatEventTime } from "@/lib/event-utils";

export const metadata = { title: "Events" };

function formatWhen(eventDate: Date): string {
  const when = describeEventDate(eventDate);
  const date = formatEventDate(when.dateKey, "short");
  return when.time ? `${date}, ${formatEventTime(when.time)}` : date;
}

// Auth/role check lives in the (admin) layout — getAllEventsForAdmin()
// still independently requires ADMIN, so data access is never gated by the
// layout alone.
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { events, totalCount, totalPages } = await getAllEventsForAdmin({ page });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="mt-1 text-sm text-slate-500">{totalCount.toLocaleString()} total.</p>
        </div>
        <Link
          href="/admin/events/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + New Event
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {event.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small admin-list thumbnail
                <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No photo
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{event.title}</p>
              <p className="text-xs text-slate-500">
                {event.eventDate ? formatWhen(event.eventDate) : "No date set"}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>

            <span
              className={
                event.published
                  ? "rounded-md bg-status-active/10 px-2 py-0.5 text-xs font-medium text-status-active"
                  : "rounded-md bg-status-draft/10 px-2 py-0.5 text-xs font-medium text-status-draft"
              }
            >
              {event.published ? "Published" : "Draft"}
            </span>

            <Link
              href={`/admin/events/${event.id}/edit`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Edit
            </Link>
            <EventPublishToggle eventId={event.id} published={event.published} />
          </div>
        ))}
        {events.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No events yet — create one above.
          </p>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => (p > 1 ? `/admin/events?page=${p}` : "/admin/events")}
      />
    </div>
  );
}

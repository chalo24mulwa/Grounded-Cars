import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventForAdmin } from "@/server/services/event-service";
import { AuthorizationError } from "@/server/authorization/ownership";
import { EventForm } from "@/components/admin/EventForm";
import { splitEventDate } from "@/lib/event-utils";

export const metadata = { title: "Edit Event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let event;
  try {
    event = await getEventForAdmin(id);
  } catch (error) {
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }

  const { date, time } = splitEventDate(event.eventDate);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Edit Event</h1>
        <Link href="/admin/events" className="text-sm font-medium text-brand hover:underline">
          ← Back to Events
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <EventForm
          mode="edit"
          eventId={event.id}
          currentImageUrl={event.imageUrl}
          defaults={{
            title: event.title,
            description: event.description,
            location: event.location ?? "",
            eventDate: date,
            eventTime: time,
          }}
        />
      </div>
    </div>
  );
}

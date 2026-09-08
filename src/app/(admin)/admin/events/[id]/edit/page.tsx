import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventForAdmin } from "@/server/services/event-service";
import { AuthorizationError } from "@/server/authorization/ownership";
import { EventForm } from "@/components/admin/EventForm";

export const metadata = { title: "Edit Event" };

// "YYYY-MM-DD" for the <input type="date"> defaultValue — toISOString()
// then slicing avoids a timezone-shifted off-by-one day some locale-based
// formatters would introduce.
function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let event;
  try {
    event = await getEventForAdmin(id);
  } catch (error) {
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }

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
            eventDate: toDateInputValue(event.eventDate),
          }}
        />
      </div>
    </div>
  );
}

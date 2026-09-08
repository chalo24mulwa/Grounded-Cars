import Link from "next/link";
import { EventForm } from "@/components/admin/EventForm";

export const metadata = { title: "New Event" };

export default function NewEventPage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">New Event</h1>
        <Link href="/admin/events" className="text-sm font-medium text-brand hover:underline">
          ← Back to Events
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <EventForm mode="create" />
      </div>
    </div>
  );
}

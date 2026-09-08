"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEventPublishedAction } from "@/server/actions/event-actions";

export function EventPublishToggle({ eventId, published }: { eventId: string; published: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setEventPublishedAction(eventId, !published);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={
          published
            ? "rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle disabled:opacity-60"
            : "rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-60"
        }
      >
        {isPending ? "Saving…" : published ? "Unpublish" : "Publish"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

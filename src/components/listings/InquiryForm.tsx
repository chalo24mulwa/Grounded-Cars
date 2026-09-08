"use client";

import { useActionState } from "react";
import { createInquiryAction, type InquiryFormState } from "@/server/actions/inquiry-actions";

const initialState: InquiryFormState = {};

export function InquiryForm({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(createInquiryAction, initialState);

  if (state.success) {
    return (
      <p className="rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">
        Your inquiry has been sent to the seller.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <textarea
        name="message"
        rows={4}
        required
        minLength={10}
        maxLength={2000}
        placeholder="Ask the seller a question about this vehicle…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}

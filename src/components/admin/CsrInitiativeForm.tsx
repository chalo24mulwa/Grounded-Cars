"use client";

import { useActionState } from "react";
import {
  createCsrInitiativeFormAction,
  updateCsrInitiativeFormAction,
  type CsrFormState,
} from "@/server/actions/csr-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: CsrFormState = {};

// Mirrors EventForm.tsx's shape (mode/defaults/currentImageUrl) with the
// CSR-specific fields (summary, story, targetAmount, start/end dates)
// layered on. `mode: "create"` posts a brand-new initiative (unpublished by
// default — see createCsrInitiative() in csr-service.ts); `mode: "edit"`
// updates one in place and only replaces the cover image if a new file was
// actually chosen.
export function CsrInitiativeForm({
  mode,
  initiativeId,
  defaults,
  currentCoverImageUrl,
}: {
  mode: "create" | "edit";
  initiativeId?: string;
  defaults?: {
    title: string;
    summary: string;
    story: string;
    targetAmount: string;
    startDate: string; // "YYYY-MM-DD" or ""
    endDate: string; // "YYYY-MM-DD" or ""
  };
  currentCoverImageUrl?: string | null;
}) {
  const action =
    mode === "edit" && initiativeId
      ? updateCsrInitiativeFormAction.bind(null, initiativeId)
      : createCsrInitiativeFormAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">
          {mode === "create" ? "Initiative created as a draft — publish it when ready." : "Saved."}
        </p>
      )}

      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={defaults?.title}
          placeholder="e.g. Meals for Street-Connected Children — Nairobi"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="summary" className={labelClass}>
          Short summary <span className="font-normal text-slate-400">(shown on cards)</span>
        </label>
        <textarea
          id="summary"
          name="summary"
          required
          rows={2}
          maxLength={300}
          defaultValue={defaults?.summary}
          placeholder="One or two sentences describing the initiative"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="story" className={labelClass}>
          Full story
        </label>
        <textarea
          id="story"
          name="story"
          required
          rows={8}
          defaultValue={defaults?.story}
          placeholder="The full story — who this helps, what the funds are used for, why it matters…"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="targetAmount" className={labelClass}>
            Target amount (KES)
          </label>
          <input
            id="targetAmount"
            name="targetAmount"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={defaults?.targetAmount}
            placeholder="500000"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="startDate" className={labelClass}>
            Start date <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={defaults?.startDate}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="endDate" className={labelClass}>
            End date <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={defaults?.endDate}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="coverImage" className={labelClass}>
          Cover photo {mode === "edit" && <span className="font-normal text-slate-400">(leave empty to keep current)</span>}
        </label>
        {currentCoverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a tiny admin-only preview thumbnail, not worth next/image's optimization pipeline
          <img
            src={currentCoverImageUrl}
            alt=""
            className="mb-2 h-24 w-36 rounded-md border border-slate-200 object-cover"
          />
        )}
        <input
          id="coverImage"
          name="coverImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand/90"
        />
        <p className="mt-1 text-xs text-slate-400">JPEG, PNG, or WebP — up to 5MB.</p>
        {mode === "create" && (
          <p className="mt-1 text-xs text-slate-400">Gallery photos can be added after creating the initiative.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create initiative" : "Save changes"}
      </button>
    </form>
  );
}

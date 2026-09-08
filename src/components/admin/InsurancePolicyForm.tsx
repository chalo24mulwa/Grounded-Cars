"use client";

import { useActionState } from "react";
import {
  createInsurancePolicyFormAction,
  updateInsurancePolicyFormAction,
  type InsuranceFormState,
} from "@/server/actions/insurance-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: InsuranceFormState = {};

// `mode: "create"` posts a brand-new policy (unpublished by default — see
// createInsurancePolicy() in insurance-service.ts); `mode: "edit"` updates
// one in place and only replaces the image if a new file was actually
// chosen — same shape as EventForm.
export function InsurancePolicyForm({
  mode,
  policyId,
  defaults,
  currentImageUrl,
}: {
  mode: "create" | "edit";
  policyId?: string;
  defaults?: {
    title: string;
    description: string;
    startingPrice: string;
  };
  currentImageUrl?: string | null;
}) {
  const action =
    mode === "edit" && policyId
      ? updateInsurancePolicyFormAction.bind(null, policyId)
      : createInsurancePolicyFormAction;
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
          {mode === "create" ? "Policy created as a draft — publish it when ready." : "Saved."}
        </p>
      )}

      <div>
        <label htmlFor="title" className={labelClass}>
          Policy name
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={defaults?.title}
          placeholder="e.g. Comprehensive Cover"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="startingPrice" className={labelClass}>
          Starting price (KES)
        </label>
        <input
          id="startingPrice"
          name="startingPrice"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={defaults?.startingPrice}
          placeholder="1000"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">Shown on the public page as &quot;From KES …&quot;.</p>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          defaultValue={defaults?.description}
          placeholder="What's covered, who it's for, how to get a quote…"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="image" className={labelClass}>
          Policy image {mode === "edit" && <span className="font-normal text-slate-400">(leave empty to keep current)</span>}
        </label>
        {currentImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a tiny admin-only preview thumbnail, not worth next/image's optimization pipeline
          <img
            src={currentImageUrl}
            alt=""
            className="mb-2 h-24 w-36 rounded-md border border-slate-200 object-cover"
          />
        )}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand/90"
        />
        <p className="mt-1 text-xs text-slate-400">JPEG, PNG, or WebP — up to 5MB.</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create policy" : "Save changes"}
      </button>
    </form>
  );
}

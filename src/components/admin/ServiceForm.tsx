"use client";

import { useActionState } from "react";
import {
  createServiceFormAction,
  updateServiceFormAction,
  type ServiceFormState,
} from "@/server/actions/service-actions";
import { SERVICE_PAGE_OPTIONS } from "@/server/validation/service-schema";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: ServiceFormState = {};

// `mode: "create"` posts a brand-new orderable listing for one of the five
// fixed /services/* pages (unpublished by default — see createService() in
// service-catalog-service.ts); `mode: "edit"` updates title/description/
// price in place. The page slug is chosen once at creation and never
// editable afterward (enforced both here — no field rendered in edit mode —
// and server-side by updateServiceSchema omitting it).
export function ServiceForm({
  mode,
  serviceId,
  defaults,
}: {
  mode: "create" | "edit";
  serviceId?: string;
  defaults?: {
    slug: string;
    title: string;
    description: string;
    price: string;
  };
}) {
  const action =
    mode === "edit" && serviceId ? updateServiceFormAction.bind(null, serviceId) : createServiceFormAction;
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
          {mode === "create" ? "Service created as a draft — publish it when ready." : "Saved."}
        </p>
      )}

      {mode === "create" ? (
        <div>
          <label htmlFor="slug" className={labelClass}>
            Which service page?
          </label>
          <select id="slug" name="slug" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a page…
            </option>
            {SERVICE_PAGE_OPTIONS.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Only one orderable listing per page — pick the page this listing should appear on.
          </p>
        </div>
      ) : (
        <div>
          <span className={labelClass}>Service page</span>
          <p className="mt-1 text-sm text-slate-600">
            {SERVICE_PAGE_OPTIONS.find((o) => o.slug === defaults?.slug)?.label ?? defaults?.slug}
          </p>
        </div>
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
          placeholder="e.g. Pre-Purchase Inspection"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          defaultValue={defaults?.description}
          placeholder="What's included, how it works, turnaround time…"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="price" className={labelClass}>
          Price (KES)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={defaults?.price}
          placeholder="1000"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create service" : "Save changes"}
      </button>
    </form>
  );
}

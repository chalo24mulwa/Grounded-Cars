"use client";

import { useActionState } from "react";
import { createFeaturedPlanAction, type PlanActionState } from "@/server/actions/admin-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-xs font-medium text-slate-600";

const initialState: PlanActionState = {};

export function CreatePlanForm() {
  const [state, formAction, pending] = useActionState(createFeaturedPlanAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
      {state.error && (
        <p className="col-span-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="name" className={labelClass}>
          Plan name
        </label>
        <input id="name" name="name" type="text" required placeholder="e.g. 14-Day Boost" className={inputClass} />
      </div>
      <div>
        <label htmlFor="durationDays" className={labelClass}>
          Duration (days)
        </label>
        <input id="durationDays" name="durationDays" type="number" min={1} max={365} required className={inputClass} />
      </div>
      <div>
        <label htmlFor="price" className={labelClass}>
          Price (KES)
        </label>
        <input id="price" name="price" type="number" min={1} step="0.01" required className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add plan"}
      </button>
    </form>
  );
}

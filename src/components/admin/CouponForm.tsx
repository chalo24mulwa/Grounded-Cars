"use client";

import { useActionState } from "react";
import {
  createCouponFormAction,
  updateCouponFormAction,
  type CouponFormState,
} from "@/server/actions/coupon-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: CouponFormState = {};

// `mode: "create"` posts a brand-new coupon; `mode: "edit"` updates one in
// place. Applies to Featured Listings and orderable Services only — never
// CSR donations or Insurance purchases, which have no coupon field
// anywhere in their own forms (see coupon-service.ts's module comment).
export function CouponForm({
  mode,
  couponId,
  defaults,
}: {
  mode: "create" | "edit";
  couponId?: string;
  defaults?: {
    code: string;
    discountPercent: string;
    usageLimitPerUser: string;
  };
}) {
  const action =
    mode === "edit" && couponId ? updateCouponFormAction.bind(null, couponId) : createCouponFormAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">Saved.</p>
      )}

      <div>
        <label htmlFor="code" className={labelClass}>
          Code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          defaultValue={defaults?.code}
          placeholder="e.g. SAVE20"
          className={`${inputClass} uppercase`}
          style={{ textTransform: "uppercase" }}
        />
        <p className="mt-1 text-xs text-slate-400">Letters, numbers, and hyphens only. Not case-sensitive.</p>
      </div>

      <div>
        <label htmlFor="discountPercent" className={labelClass}>
          Discount percentage
        </label>
        <input
          id="discountPercent"
          name="discountPercent"
          type="number"
          min="5"
          max="100"
          step="1"
          required
          defaultValue={defaults?.discountPercent}
          placeholder="20"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">Between 5% and 100% (100% makes checkout free).</p>
      </div>

      <div>
        <label htmlFor="usageLimitPerUser" className={labelClass}>
          Usage limit per user
        </label>
        <input
          id="usageLimitPerUser"
          name="usageLimitPerUser"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={defaults?.usageLimitPerUser ?? "1"}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">
          How many times the same seller (by account) or customer (by phone number, for Service
          orders) can apply this code.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create coupon" : "Save changes"}
      </button>
    </form>
  );
}

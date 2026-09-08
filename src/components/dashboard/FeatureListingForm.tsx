"use client";

import { useActionState, useState, useTransition } from "react";
import { startFeatureAction, type FeatureActionState } from "@/server/actions/featured-actions";
import { previewFeaturedCouponAction, type CouponPreviewResult } from "@/server/actions/coupon-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: FeatureActionState = {};

type ListingOption = { id: string; title: string };
type PlanOption = { id: string; name: string; durationDays: number; price: number; currency: string };

type AppliedCoupon = { code: string; discountPercent: number; discountedAmount: number };

export function FeatureListingForm({
  listings,
  plans,
  mpesaConfigured,
  preselectedListingId,
}: {
  listings: ListingOption[];
  plans: PlanOption[];
  mpesaConfigured: boolean;
  preselectedListingId?: string;
}) {
  const [state, formAction, pending] = useActionState(startFeatureAction, initialState);
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id);
  const [couponCode, setCouponCode] = useState("");
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplying, startApplying] = useTransition();

  const plan = plans.find((p) => p.id === selectedPlan);

  function handleSelectPlan(id: string) {
    setSelectedPlan(id);
    // A coupon applied against the previous plan's price no longer reflects
    // reality once the plan changes — clear it so the seller re-applies
    // against the new total rather than seeing a stale discount.
    setApplied(null);
    setCouponError(null);
  }

  function applyCoupon() {
    if (!plan || !couponCode.trim()) return;
    setCouponError(null);
    startApplying(async () => {
      const result: CouponPreviewResult = await previewFeaturedCouponAction(couponCode.trim(), plan.price);
      if (result.valid) {
        setApplied({
          code: couponCode.trim().toUpperCase(),
          discountPercent: result.discountPercent,
          discountedAmount: result.discountedAmount,
        });
      } else {
        setApplied(null);
        setCouponError(result.error);
      }
    });
  }

  function clearCoupon() {
    setApplied(null);
    setCouponCode("");
    setCouponError(null);
  }

  if (state.success) {
    return (
      <div className="rounded-xl border border-status-active/30 bg-status-active/5 p-6">
        <p className="font-semibold text-status-active">
          {state.free ? "Listing featured — free with your coupon" : mpesaConfigured ? "Check your phone" : "Payment request created (dev mode)"}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {state.free
            ? "Your coupon covered 100% of the cost, so no M-Pesa payment was needed — this listing is featured now. See it below."
            : mpesaConfigured
              ? "We sent an M-Pesa payment prompt to your phone. Once you approve it, this listing will become featured automatically — no need to refresh anything yourself, but you can check progress below."
              : "No real M-Pesa prompt was sent (Till number not configured yet). Use the [DEV] simulate buttons in the table below to test approval or failure."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Feature a car</h2>

      {!mpesaConfigured && (
        <p className="rounded-md bg-status-pending/10 px-3 py-2 text-sm text-status-pending">
          The marketplace hasn&apos;t configured a real M-Pesa Till number yet. In production this
          would block payment; in this development environment you can still submit and use the
          [DEV] simulate buttons below to test the full activation flow.
        </p>
      )}
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="listingId" className={labelClass}>
          Which car?
        </label>
        <select
          id="listingId"
          name="listingId"
          required
          defaultValue={preselectedListingId}
          className={inputClass}
        >
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={labelClass}>Choose a plan</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {plans.map((p) => (
            <label
              key={p.id}
              className={`cursor-pointer rounded-lg border p-3 text-sm ${
                selectedPlan === p.id ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="planId"
                value={p.id}
                checked={selectedPlan === p.id}
                onChange={() => handleSelectPlan(p.id)}
                className="sr-only"
              />
              <p className="font-semibold text-slate-900">{p.name}</p>
              <p className="text-slate-500">{p.durationDays} days</p>
              <p className="mt-1 font-bold text-brand">
                {p.currency} {p.price.toLocaleString()}
              </p>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="couponCode" className={labelClass}>
          Coupon code <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="couponCode"
            type="text"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value);
              if (applied) setApplied(null);
            }}
            placeholder="e.g. SAVE20"
            disabled={!!applied}
            className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
          />
          {applied ? (
            <button
              type="button"
              onClick={clearCoupon}
              className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={applyCoupon}
              disabled={isApplying || !couponCode.trim() || !plan}
              className="shrink-0 rounded-md border border-brand/30 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-subtle disabled:opacity-60"
            >
              {isApplying ? "Checking…" : "Apply"}
            </button>
          )}
        </div>
        {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
        {applied && plan && (
          <p className="mt-1 text-xs font-medium text-status-active">
            {applied.discountPercent}% off applied — new total {plan.currency}{" "}
            {applied.discountedAmount.toLocaleString()}
            {applied.discountedAmount === 0 ? " (free)" : ""}.
          </p>
        )}
        {/* Only the code the server has itself re-validated is ever sent —
            the discount shown above is a preview, not what gets charged;
            startFeatureSubscription() recomputes it from scratch. */}
        {applied && <input type="hidden" name="couponCode" value={applied.code} />}
      </div>

      <div>
        <label htmlFor="phoneNumber" className={labelClass}>
          M-Pesa phone number
        </label>
        <input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          required
          placeholder="07XXXXXXXX"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
      >
        {pending
          ? "Sending prompt…"
          : applied && plan
            ? applied.discountedAmount === 0
              ? "Activate for free"
              : `Pay ${plan.currency} ${applied.discountedAmount.toLocaleString()} with M-Pesa`
            : "Pay with M-Pesa"}
      </button>
    </form>
  );
}

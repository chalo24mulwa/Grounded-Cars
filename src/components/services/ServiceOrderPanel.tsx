"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  initiateServiceOrderFormAction,
  devSimulateServiceOrderAction,
  type OrderFormState,
} from "@/server/actions/service-actions";
import { previewServiceCouponAction, type CouponPreviewResult } from "@/server/actions/coupon-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: OrderFormState = {};

export type OrderableService = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: { id: string; imageUrl: string; altText: string | null }[];
};

type AppliedCoupon = { code: string; discountPercent: number; discountedAmount: number };

// Purely additive panel — appended after a /services/* page's existing
// static content (see ServicePageLayout's `children` slot), never replacing
// any of it. Only rendered at all when an admin has created and published a
// Service for that page's slug (see getPublishedServiceBySlug); when none
// exists, the page's own server component simply doesn't render this at
// all, leaving the page exactly as it always was.
export function ServiceOrderPanel({
  service,
  mpesaConfigured,
  isDev,
}: {
  service: OrderableService;
  mpesaConfigured: boolean;
  isDev: boolean;
}) {
  const [state, formAction, pending] = useActionState(initiateServiceOrderFormAction, initialState);
  const [simState, setSimState] = useState<{ error?: string; done?: "success" | "failure" } | null>(null);
  const [isSimPending, startSimTransition] = useTransition();
  const router = useRouter();

  const [couponCode, setCouponCode] = useState("");
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplying, startApplying] = useTransition();
  const phoneRef = useRef<HTMLInputElement>(null);

  function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError(null);
    startApplying(async () => {
      // Best-effort: the phone field may still be empty at this point (no
      // account exists yet to key the usage-limit check off), so the
      // preview passes it along only if it's already been typed. The real
      // submission below always has a phone number and always re-checks
      // the limit against it — this preview can never bypass that.
      const result: CouponPreviewResult = await previewServiceCouponAction(
        couponCode.trim(),
        service.price,
        phoneRef.current?.value
      );
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

  if (state.success && state.orderId) {
    const orderId = state.orderId;

    function simulate(outcome: "success" | "failure") {
      setSimState(null);
      startSimTransition(async () => {
        const result = await devSimulateServiceOrderAction(orderId, outcome);
        if (result.success) {
          setSimState({ done: outcome });
          router.refresh();
        } else {
          setSimState({ error: result.error });
        }
      });
    }

    return (
      <div className="mt-8 rounded-xl border border-status-active/30 bg-status-active/5 p-6">
        <p className="font-semibold text-status-active">
          {state.free ? "Order confirmed — free with your coupon" : mpesaConfigured ? "Check your phone" : "Order created (dev mode)"}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {state.free
            ? "Your coupon covered 100% of the cost, so no M-Pesa payment was needed — your order is confirmed."
            : mpesaConfigured
              ? "We sent an M-Pesa payment prompt to your phone. Once you approve it, your order will be confirmed automatically."
              : "Payments aren't configured yet, so no real M-Pesa prompt was sent."}
        </p>

        {!state.free && !mpesaConfigured && isDev && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-status-active/20 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              [DEV] Simulate the M-Pesa callback:
            </span>
            <button
              type="button"
              disabled={isSimPending}
              onClick={() => simulate("success")}
              className="rounded-md bg-status-active px-3 py-1.5 text-xs font-semibold text-white hover:bg-status-active/90 disabled:opacity-60"
            >
              Simulate success
            </button>
            <button
              type="button"
              disabled={isSimPending}
              onClick={() => simulate("failure")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Simulate failure
            </button>
            {simState?.done === "success" && (
              <span className="text-xs font-medium text-status-active">Order confirmed — thank you!</span>
            )}
            {simState?.done === "failure" && (
              <span className="text-xs font-medium text-red-600">Marked as failed.</span>
            )}
            {simState?.error && <span className="text-xs font-medium text-red-600">{simState.error}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-brand/20 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Order {service.title} online</h2>
      <p className="mt-1 text-sm text-slate-600">{service.description}</p>

      {service.images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {service.images.map((image) => (
            <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
              <Image src={image.imageUrl} alt={image.altText ?? service.title} fill className="object-cover" sizes="150px" />
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-2xl font-bold text-brand">
        {applied ? (
          <>
            <span className="mr-2 text-base font-normal text-slate-400 line-through">
              {service.currency} {service.price.toLocaleString()}
            </span>
            {service.currency} {applied.discountedAmount.toLocaleString()}
          </>
        ) : (
          <>
            {service.currency} {service.price.toLocaleString()}
          </>
        )}
      </p>

      {!mpesaConfigured && (
        <p className="mt-3 rounded-md bg-status-pending/10 px-3 py-2 text-sm text-status-pending">
          Online payment isn&apos;t configured yet.
          {isDev
            ? " In this development environment you can still submit and use the [DEV] simulate buttons afterwards to test the full flow."
            : " Please contact us using the details below to arrange payment."}
        </p>
      )}
      {state.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="serviceId" value={service.id} />

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
                disabled={isApplying || !couponCode.trim()}
                className="shrink-0 rounded-md border border-brand/30 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-subtle disabled:opacity-60"
              >
                {isApplying ? "Checking…" : "Apply"}
              </button>
            )}
          </div>
          {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
          {applied && (
            <p className="mt-1 text-xs font-medium text-status-active">
              {applied.discountPercent}% off applied
              {applied.discountedAmount === 0 ? " — this order is free." : "."}
            </p>
          )}
          {/* Only the code the server has itself re-validated is ever sent
              — the discount shown above is a preview, not what gets
              charged; initiateServiceOrder() recomputes it from scratch. */}
          {applied && <input type="hidden" name="couponCode" value={applied.code} />}
        </div>

        <div>
          <label htmlFor="customerPhone" className={labelClass}>
            M-Pesa phone number
          </label>
          <input
            ref={phoneRef}
            id="customerPhone"
            name="customerPhone"
            type="tel"
            required
            placeholder="07XXXXXXXX"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="customerName" className={labelClass}>
              Your name <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="customerName" name="customerName" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="customerEmail" className={labelClass}>
              Email <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="customerEmail" name="customerEmail" type="email" className={inputClass} />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-accent/90 disabled:opacity-60"
        >
          {pending
            ? "Sending prompt…"
            : applied
              ? applied.discountedAmount === 0
                ? "Confirm free order"
                : `Pay ${service.currency} ${applied.discountedAmount.toLocaleString()} with M-Pesa`
              : `Pay ${service.currency} ${service.price.toLocaleString()} with M-Pesa`}
        </button>
      </form>
    </div>
  );
}

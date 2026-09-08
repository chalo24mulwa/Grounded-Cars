"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  initiateInsurancePurchaseFormAction,
  devSimulateInsurancePurchaseAction,
  type InsurancePurchaseFormState,
} from "@/server/actions/insurance-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: InsurancePurchaseFormState = {};

// The price is fixed (taken from the policy, not chosen by the customer —
// see initiateInsurancePurchase() in insurance-service.ts), so unlike
// CsrDonateForm this has no amount picker — just a phone number and the
// "Buy Now / Get Cover" button. Same PENDING -> [DEV] simulate -> SUCCESS
// pattern as every other M-Pesa flow in this app (CSR donations, service
// orders, featured listings).
export function InsurancePurchaseForm({
  policyId,
  price,
  currency,
  mpesaConfigured,
  isDev,
}: {
  policyId: string;
  price: number;
  currency: string;
  mpesaConfigured: boolean;
  isDev: boolean;
}) {
  const [state, formAction, pending] = useActionState(initiateInsurancePurchaseFormAction, initialState);
  const [simState, setSimState] = useState<{ error?: string; done?: "success" | "failure" } | null>(null);
  const [isSimPending, startSimTransition] = useTransition();
  const router = useRouter();

  if (state.success && state.purchaseId) {
    const purchaseId = state.purchaseId;

    function simulate(outcome: "success" | "failure") {
      setSimState(null);
      startSimTransition(async () => {
        const result = await devSimulateInsurancePurchaseAction(purchaseId, outcome);
        if (result.success) {
          setSimState({ done: outcome });
          router.refresh();
        } else {
          setSimState({ error: result.error });
        }
      });
    }

    return (
      <div id="buy" className="rounded-xl border border-status-active/30 bg-status-active/5 p-6">
        <p className="font-semibold text-status-active">
          {mpesaConfigured ? "Check your phone" : "Purchase created (dev mode)"}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {mpesaConfigured
            ? "We sent an M-Pesa payment prompt to your phone. Once you approve it, your cover will be confirmed automatically."
            : "The M-Pesa Till number hasn't been configured yet, so no real M-Pesa prompt was sent."}
        </p>

        {!mpesaConfigured && isDev && (
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
              <span className="text-xs font-medium text-status-active">Confirmed — you&apos;re covered!</span>
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
    <div id="buy" className="rounded-xl border border-brand/20 bg-white p-6">
      <p className="text-2xl font-bold text-brand">
        {currency} {price.toLocaleString()}
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
        <input type="hidden" name="policyId" value={policyId} />

        <div>
          <label htmlFor="customerPhone" className={labelClass}>
            M-Pesa phone number
          </label>
          <input
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
          {pending ? "Sending prompt…" : `Buy Now — Pay ${currency} ${price.toLocaleString()} with M-Pesa`}
        </button>
      </form>
    </div>
  );
}

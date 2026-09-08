"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  initiateCsrDonationFormAction,
  devSimulateCsrDonationAction,
  type DonateFormState,
} from "@/server/actions/csr-actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: DonateFormState = {};

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

export function CsrDonateForm({
  initiativeId,
  currency,
  mpesaConfigured,
  isDev,
}: {
  initiativeId: string;
  currency: string;
  mpesaConfigured: boolean;
  isDev: boolean;
}) {
  const [state, formAction, pending] = useActionState(initiateCsrDonationFormAction, initialState);
  const [selectedAmount, setSelectedAmount] = useState<number | "custom">(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [simState, setSimState] = useState<{ error?: string; done?: "success" | "failure" } | null>(null);
  const [isSimPending, startSimTransition] = useTransition();
  const router = useRouter();

  if (state.success && state.donationId) {
    const donationId = state.donationId;

    function simulate(outcome: "success" | "failure") {
      setSimState(null);
      startSimTransition(async () => {
        const result = await devSimulateCsrDonationAction(donationId, outcome);
        if (result.success) {
          setSimState({ done: outcome });
          router.refresh();
        } else {
          setSimState({ error: result.error });
        }
      });
    }

    return (
      <div id="donate" className="rounded-xl border border-status-active/30 bg-status-active/5 p-6">
        <p className="font-semibold text-status-active">
          {mpesaConfigured ? "Check your phone" : "Donation request created (dev mode)"}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {mpesaConfigured
            ? "We sent an M-Pesa payment prompt to your phone. Once you approve it, your donation will be recorded automatically."
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
              <span className="text-xs font-medium text-status-active">Recorded — thank you!</span>
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
    <form id="donate" action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Make a donation</h2>

      {!mpesaConfigured && (
        <p className="rounded-md bg-status-pending/10 px-3 py-2 text-sm text-status-pending">
          The M-Pesa Till number hasn&apos;t been set up yet.
          {isDev
            ? " In this development environment you can still submit and use the [DEV] simulate buttons afterwards to test the full flow."
            : " Donations aren't available yet — please check back soon."}
        </p>
      )}
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <input type="hidden" name="initiativeId" value={initiativeId} />

      <div>
        <span className={labelClass}>Amount ({currency})</span>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setSelectedAmount(amount)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                selectedAmount === amount ? "border-brand bg-brand/5 text-brand ring-1 ring-brand" : "border-slate-300 text-slate-700"
              }`}
            >
              {amount.toLocaleString()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedAmount("custom")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              selectedAmount === "custom" ? "border-brand bg-brand/5 text-brand ring-1 ring-brand" : "border-slate-300 text-slate-700"
            }`}
          >
            Other
          </button>
        </div>
        {selectedAmount === "custom" && (
          <input
            type="number"
            min="10"
            step="1"
            required
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Enter amount"
            className={`${inputClass} mt-2`}
          />
        )}
        <input type="hidden" name="amount" value={selectedAmount === "custom" ? customAmount : selectedAmount} />
      </div>

      <div>
        <label htmlFor="donorPhone" className={labelClass}>
          M-Pesa phone number
        </label>
        <input
          id="donorPhone"
          name="donorPhone"
          type="tel"
          required
          placeholder="07XXXXXXXX"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="donorName" className={labelClass}>
            Your name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="donorName" name="donorName" type="text" placeholder="Anonymous" className={inputClass} />
        </div>
        <div>
          <label htmlFor="donorEmail" className={labelClass}>
            Email <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="donorEmail" name="donorEmail" type="email" placeholder="you@example.com" className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-accent/90 disabled:opacity-60"
      >
        {pending ? "Sending prompt…" : "Donate with M-Pesa"}
      </button>
    </form>
  );
}

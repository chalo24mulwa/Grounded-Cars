"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { devSimulatePaymentAction } from "@/server/actions/featured-actions";

type Payment = {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  amount: number;
  currency: string;
  receiptNumber?: string;
};

export type SubscriptionRow = {
  id: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "PAYMENT_FAILED";
  startedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  listingTitle: string;
  planName: string;
  payments: Payment[];
};

const STATUS_LABEL: Record<SubscriptionRow["status"], string> = {
  PENDING: "Awaiting payment",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  PAYMENT_FAILED: "Payment failed",
};

const STATUS_CLASS: Record<SubscriptionRow["status"], string> = {
  PENDING: "bg-status-pending/10 text-status-pending",
  ACTIVE: "bg-status-active/10 text-status-active",
  EXPIRED: "bg-status-archived/10 text-status-archived",
  CANCELLED: "bg-status-archived/10 text-status-archived",
  PAYMENT_FAILED: "bg-red-50 text-red-700",
};

export function SubscriptionHistory({
  subscriptions,
  isDev,
}: {
  subscriptions: SubscriptionRow[];
  isDev: boolean;
}) {
  const router = useRouter();
  const hasPending = subscriptions.some((s) => s.status === "PENDING");

  // Auto-refresh while anything is pending, so a real M-Pesa approval
  // (which arrives async via the webhook, usually within seconds) shows up
  // without the seller needing to manually reload.
  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [hasPending, router]);

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <th className="px-4 py-3">Car</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3">Expires</th>
            <th className="px-4 py-3">Days left</th>
            <th className="px-4 py-3">Payment</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-900">{sub.listingTitle}</td>
              <td className="px-4 py-3 text-slate-600">{sub.planName}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[sub.status]}`}
                >
                  {STATUS_LABEL[sub.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {sub.startedAt ? new Date(sub.startedAt).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {sub.status === "ACTIVE" && sub.daysRemaining !== null ? sub.daysRemaining : "—"}
              </td>
              <td className="px-4 py-3">
                <PaymentCell payments={sub.payments} isDev={isDev} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentCell({ payments, isDev }: { payments: Payment[]; isDev: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const latest = payments[0];
  if (!latest) return <span className="text-slate-400">—</span>;
  const latestPaymentId = latest.id; // narrowed copy — TS doesn't retain `latest`'s narrowing inside the closure below

  function simulate(outcome: "success" | "failure") {
    startTransition(async () => {
      await devSimulatePaymentAction(latestPaymentId, outcome);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <p className="text-slate-600">
        {latest.currency} {latest.amount.toLocaleString()}
        {latest.receiptNumber && (
          <span className="ml-1 text-xs text-slate-400">({latest.receiptNumber})</span>
        )}
      </p>
      {isDev && latest.status === "PENDING" && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => simulate("success")}
            className="rounded border border-status-active/40 px-2 py-0.5 text-xs font-medium text-status-active hover:bg-status-active/10 disabled:opacity-50"
          >
            [DEV] Simulate success
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => simulate("failure")}
            className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            [DEV] Simulate failure
          </button>
        </div>
      )}
    </div>
  );
}

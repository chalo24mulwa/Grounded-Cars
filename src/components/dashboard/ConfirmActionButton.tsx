"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

type ActionResult = { success: boolean; error?: string };

/**
 * Action button that requires explicit confirmation in a dialog before
 * calling the server action — used for status changes the spec calls out
 * by name as needing this (marking a vehicle SOLD, restoring a sold
 * vehicle to ACTIVE). Not a native <dialog> to keep styling consistent
 * across browsers without extra polyfill concerns; role="dialog" +
 * aria-modal keeps it accessible.
 */
export function ConfirmActionButton({
  label,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  variant = "primary",
  onAction,
}: {
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
  variant?: "primary" | "outline" | "danger";
  onAction: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await onAction();
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "rounded-md px-3 py-1.5 text-xs font-medium",
          variant === "primary" && "bg-status-sold text-white hover:opacity-90",
          variant === "outline" && "border border-slate-300 text-slate-700 hover:bg-brand-subtle",
          variant === "danger" && "border border-red-300 text-red-600 hover:bg-red-50"
        )}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
              {confirmTitle}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{confirmMessage}</p>
            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-brand-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60",
                  variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-brand/90"
                )}
              >
                {isPending ? "Please wait…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

type ActionResult = { success: boolean; error?: string };
type Variant = "primary" | "outline" | "danger";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand/90",
  outline: "border border-slate-300 text-slate-700 hover:bg-brand-subtle",
  danger: "border border-red-300 text-red-600 hover:bg-red-50",
};

/** Low-friction action button — calls the action immediately, no dialog.
 * For non-destructive, easily-reversible transitions (submit for review,
 * archive, withdraw). See ConfirmActionButton for ones that need explicit
 * confirmation first (mark as sold, restore). */
export function ActionButton({
  label,
  pendingLabel,
  variant = "outline",
  onAction,
  onSuccess,
}: {
  label: string;
  pendingLabel?: string;
  variant?: Variant;
  onAction: () => Promise<ActionResult>;
  /** Optional: replaces the default (refresh the page and wait for it), for
   * callers that show their own success message right away. */
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await onAction();
      if (result.success) {
        if (onSuccess) onSuccess();
        else router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={clsx(
          "rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60",
          VARIANT_CLASS[variant]
        )}
      >
        {isPending ? (pendingLabel ?? "Please wait…") : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

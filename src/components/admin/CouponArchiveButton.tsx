"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveCouponAction, unarchiveCouponAction } from "@/server/actions/coupon-actions";

// The "delete" action from the admin's point of view — soft delete, never
// a hard DELETE (see archiveCoupon()'s own comment in coupon-service.ts).
export function CouponArchiveButton({
  couponId,
  mode,
}: {
  couponId: string;
  mode: "archive" | "unarchive";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "archive" ? await archiveCouponAction(couponId) : await unarchiveCouponAction(couponId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={
          mode === "archive"
            ? "rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            : "rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle disabled:opacity-60"
        }
      >
        {isPending ? "Saving…" : mode === "archive" ? "Archive" : "Restore"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

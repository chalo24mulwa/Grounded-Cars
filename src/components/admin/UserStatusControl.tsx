"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserStatusAction } from "@/server/actions/admin-actions";
import type { UserStatus } from "@prisma/client";

const OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DEACTIVATED", label: "Deactivated" },
];

export function UserStatusControl({ userId, status }: { userId: string; status: UserStatus }) {
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function requestChange(next: UserStatus) {
    if (next === status) return;
    setPendingStatus(next);
    setError(null);
  }

  function confirm(reason: string) {
    if (!pendingStatus) return;
    startTransition(async () => {
      const result = await setUserStatusAction(userId, pendingStatus, reason || undefined);
      if (result.success) {
        setPendingStatus(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={isPending || opt.value === status}
            onClick={() => requestChange(opt.value)}
            className={`rounded-md px-2 py-1 text-xs font-medium disabled:cursor-default ${
              opt.value === status
                ? "bg-slate-100 text-slate-400"
                : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {pendingStatus && (
        <div className="w-64 rounded-md border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs text-slate-600">
            Change status to <span className="font-semibold">{pendingStatus}</span>?
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <input
            id={`reason-${userId}`}
            type="text"
            placeholder="Reason (optional, kept in audit log)"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm((e.target as HTMLInputElement).value);
            }}
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const input = document.getElementById(`reason-${userId}`) as HTMLInputElement | null;
                confirm(input?.value ?? "");
              }}
              className="rounded bg-brand px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setPendingStatus(null)}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

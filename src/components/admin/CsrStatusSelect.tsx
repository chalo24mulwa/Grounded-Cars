"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCsrInitiativeStatusAction } from "@/server/actions/csr-actions";
import type { CsrInitiativeStatus } from "@prisma/client";

export function CsrStatusSelect({
  initiativeId,
  status,
}: {
  initiativeId: string;
  status: CsrInitiativeStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(next: CsrInitiativeStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setCsrInitiativeStatusAction(initiativeId, next);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value as CsrInitiativeStatus)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
      >
        <option value="ACTIVE">Active</option>
        <option value="COMPLETED">Completed</option>
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

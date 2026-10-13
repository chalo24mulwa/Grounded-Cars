"use client";

import { useState, useTransition } from "react";
import { adminReportAction, runCleanupNowAction } from "@/server/actions/trending-actions";

type Kind = Parameters<typeof adminReportAction>[0];

export function TrendingAdminControls({
  reportId,
  videoId,
  commentId,
  offenderProfileId,
  offenderSuspended,
}: {
  reportId: string;
  videoId: string | null;
  commentId: string | null;
  offenderProfileId: string | null;
  offenderSuspended: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (kind: Kind, id: string, confirmText?: string) =>
    start(async () => {
      if (confirmText && !window.confirm(confirmText)) return;
      const r = await adminReportAction(kind, id, reportId);
      if (!r.ok) setError(r.error);
    });
  const btn = "rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {videoId && (
        <button type="button" disabled={pending} onClick={() => act("removeVideo", videoId, "Remove this video for everyone and delete it?")} className={`${btn} bg-red-600 text-white`}>
          Remove video
        </button>
      )}
      {commentId && (
        <button type="button" disabled={pending} onClick={() => act("deleteComment", commentId, "Delete this comment and its replies?")} className={`${btn} bg-red-600 text-white`}>
          Delete comment
        </button>
      )}
      {offenderProfileId && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(offenderSuspended ? "restorePosting" : "suspendPosting", offenderProfileId)}
          className={`${btn} border border-slate-300 bg-white text-slate-800`}
        >
          {offenderSuspended ? "Allow posting again" : "Suspend posting"}
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => act("resolve", reportId)} className={`${btn} border border-slate-300 bg-white text-slate-800`}>
        Mark resolved
      </button>
      <button type="button" disabled={pending} onClick={() => act("dismiss", reportId)} className={`${btn} text-slate-500`}>
        Dismiss
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RunCleanupButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runCleanupNowAction();
            setMessage(
              r.ok
                ? `Cleanup done: ${r.data.removed} video(s) deleted, ~${r.data.freedMinutes} minutes freed${r.data.failed ? `, ${r.data.failed} will be retried` : ""}.`
                : r.error
            );
          })
        }
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Running…" : "Run cleanup now"}
      </button>
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { reportAction } from "@/server/actions/trending-actions";
import { BottomSheet } from "@/components/trending/BottomSheet";

const REASONS = [
  "Spam or scam",
  "Nudity or sexual content",
  "Violence or dangerous acts",
  "Hate or harassment",
  "Misleading car information",
  "Not about cars",
  "Other",
];

export function ReportSheet({
  targetType,
  targetId,
  onClose,
}: {
  targetType: "VIDEO" | "COMMENT" | "PROFILE";
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const label = targetType === "VIDEO" ? "video" : targetType === "COMMENT" ? "comment" : "account";

  return (
    <BottomSheet title={`Report ${label}`} onClose={onClose} height="auto">
      {done ? (
        <p className="p-6 text-center text-sm text-slate-700">Thanks — our team will review this {label}.</p>
      ) : (
        <form
          className="space-y-3 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return setMessage("Please choose a reason.");
            start(async () => {
              const result = await reportAction(targetType, targetId, reason, details);
              if (result.ok) setDone(true);
              else setMessage(result.error);
            });
          }}
        >
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium text-slate-700">Why are you reporting this?</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50">
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                {r}
              </label>
            ))}
          </fieldset>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Anything else? (optional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {message && <p className="text-sm text-red-600">{message}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Sending…" : "Submit report"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}

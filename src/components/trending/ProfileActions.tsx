"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { messageProfileAction, setBlockedAction } from "@/server/actions/trending-actions";
import { ReportSheet } from "@/components/trending/ReportSheet";

/** Message / block / report buttons on someone else's profile. */
export function ProfileActions({
  profileId,
  username,
  signedIn,
  blocked,
}: {
  profileId: string;
  username: string;
  signedIn: boolean;
  blocked: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/trending/u/${username}`)}`;
  const guard = () => {
    if (!signedIn) {
      router.push(loginHref);
      return false;
    }
    return true;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {!blocked && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              guard() &&
              start(async () => {
                const r = await messageProfileAction(profileId);
                if (r && !r.ok) setError(r.error);
              })
            }
            className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Message
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            guard() &&
            start(async () => {
              if (!blocked && !window.confirm(`Block @${username}? You won't see each other's videos or messages.`)) return;
              const r = await setBlockedAction(profileId, !blocked);
              if (!r.ok) setError(r.error);
              else router.refresh();
            })
          }
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          {blocked ? "Unblock" : "Block"}
        </button>
        <button
          type="button"
          onClick={() => guard() && setReporting(true)}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Report
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {reporting && <ReportSheet targetType="PROFILE" targetId={profileId} onClose={() => setReporting(false)} />}
    </div>
  );
}

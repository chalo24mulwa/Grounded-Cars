"use client";

import { useEffect } from "react";
import Link from "next/link";

// Root error boundary — didn't exist before Phase 7. Without this, an
// uncaught error thrown while a Server Component renders (e.g.
// AccountSuspendedError surfacing from requireAuth() while a page fetches
// its data, not from a form action that already has its own inline error
// state) fell through to Next.js's default unstyled error screen. This
// gives every such case — not just suspension — a consistent, branded
// "something went wrong" page instead.
//
// Never renders `error.message` for an unexpected error (only for the
// AccountSuspendedError case, whose message is always the fixed, already
// user-safe copy from ownership.ts — never a raw thrown value) — this is
// the boundary that catches whatever an upstream bug throws, so it must
// assume that could be anything, including something that reveals internal
// detail if printed directly. `error.digest` (Next.js's own per-error
// correlation id, already stripped of message/stack before reaching the
// client) is what a support conversation should reference instead.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const isSuspended = error.name === "AccountSuspendedError";

  useEffect(() => {
    // Next.js already logs the full error server-side before this
    // boundary ever renders; this is the client-side half of that trail,
    // useful when reproducing a report from a user's own browser console.
    console.error("Unhandled error reached the root boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">
        {isSuspended ? "Account suspended" : "Something went wrong"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {isSuspended
          ? error.message
          : "Please try again, or contact support if this keeps happening."}
      </p>
      {!isSuspended && error.digest && (
        <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
      )}
      <div className="mt-4">
        <Link href="/" className="text-sm font-medium text-brand hover:underline">
          Return home
        </Link>
      </div>
    </div>
  );
}

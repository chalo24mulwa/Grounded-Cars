"use client";

import { useActionState } from "react";
import {
  startImpersonationAction,
  type ImpersonationActionState,
} from "@/server/actions/admin-actions";

const initialState: ImpersonationActionState = {};

// Same form-submit pattern as UserStatusControl/BecomeSellerButton — this is
// a real mutation (swaps the admin's own session to act as this user), not
// navigation, so it has to be a server action, not a plain link.
export function ImpersonateUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [state, formAction, pending] = useActionState(startImpersonationAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      {state.error && <p className="mb-1 max-w-[10rem] text-right text-xs text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        title={`Log in as ${userName}`}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-brand-subtle disabled:opacity-60"
      >
        {pending ? "Loading…" : "Log in as user"}
      </button>
    </form>
  );
}

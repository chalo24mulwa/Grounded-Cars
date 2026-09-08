"use client";

import { useActionState } from "react";
import { createModeratorFormAction, type ModeratorFormState } from "@/server/actions/admin-actions";
import { PasswordInput } from "@/components/auth/PasswordInput";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: ModeratorFormState = {};

// Create-only — there is no edit form here. A moderator's own name/phone
// are theirs to update from /account like any other user; the admin's
// remaining controls over the account are status (UserStatusControl) and
// delete (see /admin/moderators), not editing its profile fields.
export function ModeratorForm() {
  const [state, formAction, pending] = useActionState(createModeratorFormAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">
          Moderator account created.
        </p>
      )}

      <div>
        <label htmlFor="name" className={labelClass}>
          Full name
        </label>
        <input id="name" name="name" type="text" required minLength={2} className={inputClass} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
        <p className="mt-1 text-xs text-slate-400">
          They&apos;ll sign in with this email and the password below.
        </p>
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <PasswordInput id="password" name="password" required minLength={8} />
        <p className="mt-1 text-xs text-slate-400">
          At least 8 characters. Share this with them directly — it isn&apos;t emailed.
        </p>
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
          Phone <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input id="phone" name="phone" type="tel" className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create moderator"}
      </button>
    </form>
  );
}

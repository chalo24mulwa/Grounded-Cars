"use client";

import { useActionState, useRef, useEffect } from "react";
import { changePasswordAction, type AuthActionState } from "@/server/actions/auth-actions";
import { PasswordInput } from "@/components/auth/PasswordInput";

const labelClass = "block text-sm font-medium text-slate-700";

const initialState: AuthActionState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">
          Password changed.
        </p>
      )}

      <div>
        <label htmlFor="currentPassword" className={labelClass}>
          Current password
        </label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          required
          autoComplete="current-password"
        />
      </div>

      <div>
        <label htmlFor="newPassword" className={labelClass}>
          New password
        </label>
        <PasswordInput id="newPassword" name="newPassword" required minLength={8} autoComplete="new-password" />
      </div>

      <div>
        <label htmlFor="confirmNewPassword" className={labelClass}>
          Confirm new password
        </label>
        <PasswordInput
          id="confirmNewPassword"
          name="confirmNewPassword"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

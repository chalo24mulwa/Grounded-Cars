"use client";

import { useActionState, useEffect, useRef } from "react";
import { becomeSellerAction, type AuthActionState } from "@/server/actions/auth-actions";

const initialState: AuthActionState = {};

export function BecomeSellerButton({
  redirectTo,
  label = "Become a seller",
  pendingLabel,
  className,
  autoSubmit = false,
}: {
  /** Where becomeSellerAction sends the browser after the upgrade — falls
   * back to its own default (/dashboard) when omitted, same as before this
   * became reusable outside the Account page. */
  redirectTo?: string;
  label?: string;
  pendingLabel?: string;
  className?: string;
  /** Submits itself once on mount instead of waiting for a click — used
   * when this is reached via a link that already represents the user's
   * intent (e.g. "Sell a Car" while logged out, routed here after signing
   * in) so the upgrade genuinely happens automatically, no extra tap. */
  autoSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState(becomeSellerAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (autoSubmit && !submitted.current) {
      submitted.current = true;
      formRef.current?.requestSubmit();
    }
  }, [autoSubmit]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={
          className ??
          "rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white disabled:opacity-60"
        }
      >
        {pending ? (pendingLabel ?? "Upgrading…") : label}
      </button>
    </form>
  );
}

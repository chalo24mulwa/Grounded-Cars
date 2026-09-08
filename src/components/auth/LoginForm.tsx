"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthActionState } from "@/server/actions/auth-actions";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordInput } from "@/components/auth/PasswordInput";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const initialState: AuthActionState = {};

export function LoginForm({
  notice,
  googleError,
  callbackUrl,
}: {
  notice?: string;
  /** Set when Google sign-in itself failed/was cancelled — Auth.js always
   * redirects OAuth errors back to pages.signIn (this page), regardless of
   * whether the attempt started here or from /register. Distinct from
   * `state.error` below, which only ever reflects this page's own
   * credentials-form submission. */
  googleError?: string;
  callbackUrl?: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div>
      <GoogleSignInButton callbackUrl={callbackUrl} formLabel="Log in with your details" />

      {googleError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {googleError}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        {notice && !state.error && (
          <p className="rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">{notice}</p>
        )}
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {state.error}
          </p>
        )}

        <div>
          <label htmlFor="email" className={labelClass}>
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" name="password" required autoComplete="current-password" />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Log in"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            href={callbackUrl ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"}
            className="font-medium text-brand hover:underline"
          >
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}

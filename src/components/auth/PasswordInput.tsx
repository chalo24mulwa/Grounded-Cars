"use client";

import { useId, useState } from "react";

// Shared by every password field on the site (login, register, change
// password, reset password) — one component so the show/hide behavior and
// styling can never drift out of sync between forms. Renders the exact same
// bordered input every password field already used (same classes as the
// other auth inputs' `inputClass`), just with room carved out on the right
// for the toggle button — nothing about validation, name/id wiring, or
// autoComplete changes, so server-side validation and password-manager
// autofill both keep working exactly as before.
export function PasswordInput({
  id,
  name,
  required,
  minLength,
  autoComplete,
  className,
}: {
  id: string;
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  // Toggle button needs its own id distinct from the input's, but must
  // stay stable across re-renders (useId, not Math.random/Date.now) so it
  // doesn't churn on every keystroke's re-render.
  const toggleId = useId();

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={
          className ??
          "w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        }
      />
      <button
        id={toggleId}
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        // tabIndex left at default (0) — a sighted mouse/keyboard user can
        // reach and toggle this like any other control; it just sits
        // visually inside the field's own right edge rather than after it
        // in the form's flow.
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none focus:text-brand"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19.5c-7 0-10.5-7-10.5-7a19.23 19.23 0 0 1 4.22-5.19M9.9 4.72A10.4 10.4 0 0 1 12 4.5c7 0 10.5 7 10.5 7a19.35 19.35 0 0 1-2.19 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1.5 1.5l21 21" />
    </svg>
  );
}

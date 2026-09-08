import { signInWithGoogleAction } from "@/server/actions/auth-actions";

// Rendered above the existing email/password form on both /login and
// /register (a returning Google-only user — no password ever set — has to
// be able to sign back in from /login too, not just register once from
// /register). This is its own <form>, not nested inside the
// credentials form below it: the two submit to entirely different server
// actions, and HTML doesn't allow nested forms.
export function GoogleSignInButton({
  callbackUrl,
  formLabel,
}: {
  callbackUrl?: string;
  /** e.g. "Register with your details" / "Log in with your details" —
   * the divider caption under the OR line, so each page's copy still makes
   * sense on its own. */
  formLabel: string;
}) {
  return (
    <div className="mb-6 space-y-4">
      <form action={signInWithGoogleAction}>
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2.5 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">
        {formLabel}
      </p>
    </div>
  );
}

// Google's official four-color "G" mark — the standard glyph Google itself
// specifies for "Sign in with Google" buttons, reproduced here as inline
// SVG (no external asset/network request needed for a small icon that's
// this widely used and stable).
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

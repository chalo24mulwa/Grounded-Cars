import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { roleDestination, safeCallbackUrl } from "@/lib/role-destination";
import { LoginForm } from "@/components/auth/LoginForm";

// noindex: a bare login form has nothing worth ranking and would only
// ever show searchers a dead-end page instead of real content — still
// fully crawlable (follow: true) so link equity/discovery isn't blocked.
export const metadata = { title: "Log in", robots: { index: false, follow: true } };

// Auth.js's own OAuth error codes (thrown internally, or produced by our
// `signIn` callback in lib/auth.ts returning false), translated into copy a
// visitor can actually act on. Every code funnels here because
// authConfig.pages.signIn is "/login" — a failed Google attempt started
// from /register still lands back on this page, not that one.
function googleErrorMessage(code: string | undefined): string | undefined {
  switch (code) {
    case undefined:
      return undefined;
    case "AccessDenied":
      // Covers both "cancelled the Google consent screen" and our own
      // signIn callback rejecting an unverified email / suspended account —
      // Auth.js collapses both to this one code, and neither is worth
      // distinguishing for the visitor.
      return "Google sign-in was cancelled or couldn't be completed. Please try again, or log in with your email and password.";
    case "Configuration":
      return "Google sign-in isn't available right now. Please log in with your email and password instead.";
    default:
      return "Something went wrong signing in with Google. Please try again.";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; reset?: string; callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl ?? roleDestination(session.user.role));

  const notice = params.registered
    ? "Account created — please log in."
    : params.reset
      ? "Password reset — please log in with your new password."
      : undefined;

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900">Log in</h1>
      <LoginForm
        notice={notice}
        googleError={googleErrorMessage(params.error)}
        callbackUrl={callbackUrl ?? undefined}
      />
    </div>
  );
}

import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

// noindex — see login/page.tsx's comment. Also carries a one-time reset
// token in the URL, one more reason it should never be indexed/cached.
export const metadata = { title: "Set a new password", robots: { index: false, follow: true } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold text-slate-900">Invalid reset link</h1>
        <p className="text-sm text-slate-600">
          This password reset link is missing its token. Request a new one from the{" "}
          <Link href="/forgot-password" className="font-medium text-brand hover:underline">
            forgot password
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900">Set a new password</h1>
      <ResetPasswordForm token={token} />
    </div>
  );
}

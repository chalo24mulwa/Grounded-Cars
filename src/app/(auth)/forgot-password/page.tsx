import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

// noindex — see login/page.tsx's comment.
export const metadata = { title: "Forgot password", robots: { index: false, follow: true } };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900">Reset your password</h1>
      <ForgotPasswordForm />
    </div>
  );
}

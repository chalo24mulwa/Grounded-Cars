import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900">Reset your password</h1>
      <ForgotPasswordForm />
    </div>
  );
}

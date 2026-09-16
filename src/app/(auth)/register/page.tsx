import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { roleDestination, safeCallbackUrl } from "@/lib/role-destination";
import { RegisterForm } from "@/components/auth/RegisterForm";

// noindex — see login/page.tsx's comment; same reasoning applies to every
// page in this route group.
export const metadata = { title: "Create your account", robots: { index: false, follow: true } };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl ?? roleDestination(session.user.role));

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900">Create your account</h1>
      <RegisterForm callbackUrl={callbackUrl ?? undefined} />
    </div>
  );
}

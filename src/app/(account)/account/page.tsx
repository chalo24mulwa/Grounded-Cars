import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentUserProfile } from "@/server/services/auth-service";
import { logoutAction } from "@/server/actions/auth-actions";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { BecomeSellerButton } from "@/components/auth/BecomeSellerButton";

export const metadata = { title: "Your account" };

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  ADMIN: "Administrator",
  MODERATOR: "Moderator",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; autoSeller?: string }>;
}) {
  // Defense in depth: middleware already protects /account/*, but this page
  // never trusts that alone — it re-verifies the session itself before
  // touching any data.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { error, autoSeller } = await searchParams;
  const profile = await getCurrentUserProfile();
  // Landed here from the header's "Sell a Car" link (via /login or
  // /register's callbackUrl) — a brand-new or existing BUYER account with
  // clear intent to sell. Auto-submits the same upgrade the manual "Become
  // a seller" button below performs, then continues on to Add New Car —
  // see BecomeSellerButton's autoSubmit prop.
  const shouldAutoBecomeSeller = autoSeller === "1" && profile.role === "BUYER";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Your account</h1>

      {shouldAutoBecomeSeller && (
        <div className="mt-4 rounded-md bg-brand/10 px-3 py-2 text-sm text-brand">
          Setting up your seller account…
          <BecomeSellerButton
            redirectTo="/dashboard/listings/new"
            autoSubmit
            label="Continue"
            pendingLabel="Setting up your seller account…"
            className="sr-only"
          />
        </div>
      )}

      {error === "forbidden" && (
        <p className="mt-4 rounded-md bg-status-pending/10 px-3 py-2 text-sm text-status-pending">
          You don&apos;t have access to that page.
        </p>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="font-medium text-slate-900">{profile.email}</p>
          </div>
          <span className="inline-flex rounded-md bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
            {ROLE_LABELS[profile.role] ?? profile.role}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Account status</dt>
            <dd className="font-medium text-slate-900">{profile.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Member since</dt>
            <dd className="font-medium text-slate-900">
              {profile.createdAt.toLocaleDateString()}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-3">
          {profile.role === "SELLER" || profile.role === "ADMIN" || profile.role === "MODERATOR" ? (
            <a
              href="/dashboard"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-subtle"
            >
              {profile.role === "MODERATOR" ? "Go to moderator dashboard" : "Go to seller dashboard"}
            </a>
          ) : null}
          {profile.role === "ADMIN" ? (
            <a
              href="/admin"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Go to admin area
            </a>
          ) : null}
          {profile.role === "BUYER" ? <BecomeSellerButton /> : null}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Profile details</h2>
        <ProfileForm name={profile.name} phone={profile.phone} />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Change password</h2>
        <ChangePasswordForm />
      </section>

      <form action={logoutAction} className="mt-6">
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-subtle"
        >
          Log out
        </button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { ModeratorForm } from "@/components/admin/ModeratorForm";

export const metadata = { title: "New Moderator" };

export default function NewModeratorPage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">New Moderator</h1>
        <Link href="/admin/moderators" className="text-sm font-medium text-brand hover:underline">
          ← Back to Moderators
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Full seller access, plus reviewing pending listings and viewing the seller directory — see{" "}
        <Link href="/admin/moderators" className="underline hover:text-brand">
          Moderators
        </Link>{" "}
        for what this role can and can&apos;t do.
      </p>

      <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <ModeratorForm />
      </div>
    </div>
  );
}

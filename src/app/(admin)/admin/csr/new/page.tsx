import Link from "next/link";
import { CsrInitiativeForm } from "@/components/admin/CsrInitiativeForm";

export const metadata = { title: "New CSR Initiative" };

export default function NewCsrInitiativePage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">New CSR Initiative</h1>
        <Link href="/admin/csr" className="text-sm font-medium text-brand hover:underline">
          ← Back to CSR Initiatives
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <CsrInitiativeForm mode="create" />
      </div>
    </div>
  );
}

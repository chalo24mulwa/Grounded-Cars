import Link from "next/link";
import { InsurancePolicyForm } from "@/components/admin/InsurancePolicyForm";

export const metadata = { title: "New Insurance Policy" };

export default function NewInsurancePolicyPage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">New Insurance Policy</h1>
        <Link href="/admin/insurance" className="text-sm font-medium text-brand hover:underline">
          ← Back to Insurance Policies
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <InsurancePolicyForm mode="create" />
      </div>
    </div>
  );
}

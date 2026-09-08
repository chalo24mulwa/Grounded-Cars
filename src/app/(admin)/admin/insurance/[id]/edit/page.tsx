import Link from "next/link";
import { notFound } from "next/navigation";
import { getInsurancePolicyForAdmin, InsurancePolicyNotFoundError } from "@/server/services/insurance-service";
import { InsurancePolicyForm } from "@/components/admin/InsurancePolicyForm";

export const metadata = { title: "Edit Insurance Policy" };

export default async function EditInsurancePolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let policy;
  try {
    policy = await getInsurancePolicyForAdmin(id);
  } catch (error) {
    if (error instanceof InsurancePolicyNotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Edit Insurance Policy</h1>
        <Link href="/admin/insurance" className="text-sm font-medium text-brand hover:underline">
          ← Back to Insurance Policies
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <InsurancePolicyForm
          mode="edit"
          policyId={policy.id}
          currentImageUrl={policy.imageUrl}
          defaults={{
            title: policy.title,
            description: policy.description,
            startingPrice: String(Number(policy.startingPrice)),
          }}
        />
      </div>
    </div>
  );
}

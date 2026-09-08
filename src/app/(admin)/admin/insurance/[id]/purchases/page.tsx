import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInsurancePurchasesForAdmin,
  extractInsurancePurchaseReceipt,
  InsurancePolicyNotFoundError,
} from "@/server/services/insurance-service";

export const metadata = { title: "Insurance Purchases" };

const statusClass: Record<string, string> = {
  SUCCESS: "bg-status-active/10 text-status-active",
  PENDING: "bg-status-pending/10 text-status-pending",
  FAILED: "bg-red-50 text-red-700",
};

export default async function InsurancePurchasesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getInsurancePurchasesForAdmin(id);
  } catch (error) {
    if (error instanceof InsurancePolicyNotFoundError) notFound();
    throw error;
  }

  const { policy, purchases, totalRevenue, purchaseCount } = data;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
          <p className="mt-1 text-sm text-slate-500">{policy.title}</p>
        </div>
        <Link href="/admin/insurance" className="text-sm font-medium text-brand hover:underline">
          ← Back to Insurance Policies
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total revenue</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {policy.currency} {totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Price</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {policy.currency} {Number(policy.startingPrice).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Successful purchases</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{purchaseCount}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Customer</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Phone</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Amount</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {purchase.initiatedAt.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-700">{purchase.customerName || "Anonymous"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{purchase.customerPhone}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-900">
                  {purchase.currency} {Number(purchase.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass[purchase.status] ?? ""}`}>
                    {purchase.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                  {extractInsurancePurchaseReceipt(purchase.metadata) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">No purchases yet for this policy.</p>
        )}
      </div>
    </div>
  );
}

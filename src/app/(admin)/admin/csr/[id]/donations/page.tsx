import Link from "next/link";
import { notFound } from "next/navigation";
import { getCsrDonationsForAdmin, extractCsrDonationReceipt } from "@/server/services/csr-service";
import { InitiativeNotFoundError } from "@/server/services/csr-service";

export const metadata = { title: "CSR Donations" };

const statusClass: Record<string, string> = {
  SUCCESS: "bg-status-active/10 text-status-active",
  PENDING: "bg-status-pending/10 text-status-pending",
  FAILED: "bg-red-50 text-red-700",
};

export default async function CsrDonationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getCsrDonationsForAdmin(id);
  } catch (error) {
    if (error instanceof InitiativeNotFoundError) notFound();
    throw error;
  }

  const { initiative, donations, totalRaised, donationCount } = data;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Donations</h1>
          <p className="mt-1 text-sm text-slate-500">{initiative.title}</p>
        </div>
        <Link href="/admin/csr" className="text-sm font-medium text-brand hover:underline">
          ← Back to CSR Initiatives
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total raised</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {initiative.currency} {totalRaised.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Target</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {initiative.currency} {Number(initiative.targetAmount).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Successful donations</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{donationCount}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Donor</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Phone</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Amount</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {donations.map((donation) => (
              <tr key={donation.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {donation.initiatedAt.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-700">{donation.donorName || "Anonymous"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{donation.donorPhone}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-900">
                  {donation.currency} {Number(donation.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass[donation.status] ?? ""}`}>
                    {donation.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                  {extractCsrDonationReceipt(donation.metadata) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {donations.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">No donations yet for this initiative.</p>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getServiceOrdersForAdmin,
  extractServiceOrderReceipt,
  ServiceNotFoundError,
} from "@/server/services/service-catalog-service";

export const metadata = { title: "Service Orders" };

const statusClass: Record<string, string> = {
  SUCCESS: "bg-status-active/10 text-status-active",
  PENDING: "bg-status-pending/10 text-status-pending",
  FAILED: "bg-red-50 text-red-700",
};

export default async function ServiceOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getServiceOrdersForAdmin(id);
  } catch (error) {
    if (error instanceof ServiceNotFoundError) notFound();
    throw error;
  }

  const { service, orders, totalRevenue, orderCount } = data;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">{service.title}</p>
        </div>
        <Link href="/admin/services" className="text-sm font-medium text-brand hover:underline">
          ← Back to Services
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total revenue</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {service.currency} {totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Price</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {service.currency} {Number(service.price).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Successful orders</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{orderCount}</p>
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
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {order.initiatedAt.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-700">{order.customerName || "Anonymous"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{order.customerPhone}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-900">
                  {order.currency} {Number(order.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass[order.status] ?? ""}`}>
                    {order.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                  {extractServiceOrderReceipt(order.metadata) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">No orders yet for this service.</p>
        )}
      </div>
    </div>
  );
}

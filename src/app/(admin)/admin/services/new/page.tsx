import Link from "next/link";
import { ServiceForm } from "@/components/admin/ServiceForm";

export const metadata = { title: "New Service" };

export default function NewServicePage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">New Service</h1>
        <Link href="/admin/services" className="text-sm font-medium text-brand hover:underline">
          ← Back to Services
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <ServiceForm mode="create" />
      </div>
    </div>
  );
}

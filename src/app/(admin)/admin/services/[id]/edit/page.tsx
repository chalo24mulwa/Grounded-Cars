import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceForAdmin, ServiceNotFoundError } from "@/server/services/service-catalog-service";
import { ServiceForm } from "@/components/admin/ServiceForm";
import { ServiceGalleryManager } from "@/components/admin/ServiceGalleryManager";

export const metadata = { title: "Edit Service" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let service;
  try {
    service = await getServiceForAdmin(id);
  } catch (error) {
    if (error instanceof ServiceNotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Edit Service</h1>
        <Link href="/admin/services" className="text-sm font-medium text-brand hover:underline">
          ← Back to Services
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <ServiceForm
          mode="edit"
          serviceId={service.id}
          defaults={{
            slug: service.slug,
            title: service.title,
            description: service.description,
            price: String(Number(service.price)),
          }}
        />
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
        <p className="mt-1 text-sm text-slate-500">Shown to customers on this service's order panel.</p>
        <div className="mt-4">
          <ServiceGalleryManager serviceId={service.id} images={service.images} />
        </div>
      </div>
    </div>
  );
}

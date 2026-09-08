import Link from "next/link";
import { getAllServicesForAdmin } from "@/server/services/service-catalog-service";
import { SERVICE_PAGE_OPTIONS } from "@/server/validation/service-schema";
import { ServicePublishToggle } from "@/components/admin/ServicePublishToggle";

export const metadata = { title: "Services" };

function labelFor(slug: string) {
  return SERVICE_PAGE_OPTIONS.find((o) => o.slug === slug)?.label ?? slug;
}

// Auth/role check lives in the (admin) layout — getAllServicesForAdmin()
// still independently requires ADMIN, so data access is never gated by the
// layout alone.
export default async function AdminServicesPage() {
  const services = await getAllServicesForAdmin();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Services</h1>
          <p className="mt-1 text-sm text-slate-500">
            Orderable listings for the existing Our Services pages — {services.length} of{" "}
            {SERVICE_PAGE_OPTIONS.length} pages have one.
          </p>
        </div>
        <Link
          href="/admin/services/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + New Service
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{service.title}</p>
              <p className="text-xs text-slate-500">
                {labelFor(service.slug)} · {service.currency} {Number(service.price).toLocaleString()}
                {" · "}
                {service._count.orders} successful order{service._count.orders === 1 ? "" : "s"}
              </p>
            </div>

            <span
              className={
                service.published
                  ? "rounded-md bg-status-active/10 px-2 py-0.5 text-xs font-medium text-status-active"
                  : "rounded-md bg-status-draft/10 px-2 py-0.5 text-xs font-medium text-status-draft"
              }
            >
              {service.published ? "Published" : "Draft"}
            </span>

            <Link
              href={`/admin/services/${service.id}/orders`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Orders
            </Link>
            <Link
              href={`/admin/services/${service.id}/edit`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Edit
            </Link>
            <ServicePublishToggle serviceId={service.id} published={service.published} />
          </div>
        ))}
        {services.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No services yet — create one above to let customers order and pay for it online.
          </p>
        )}
      </div>
    </div>
  );
}

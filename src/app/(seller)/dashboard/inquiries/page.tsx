import { getMyReceivedInquiries } from "@/server/services/inquiry-service";
import { InquiryRow } from "@/components/dashboard/InquiryRow";

export const metadata = { title: "Inquiries" };

// Auth/role check lives in the (seller) layout — getMyReceivedInquiries()
// below still independently requires SELLER/ADMIN and scopes to
// `sellerId = me` itself, so the data access is never gated by the layout
// alone. A seller can only ever see inquiries whose sellerId matches their
// own session id — there is no code path here that accepts a different
// seller's id from anywhere.
export default async function InquiriesPage() {
  const inquiries = await getMyReceivedInquiries();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Inquiries</h1>
      <p className="mt-1 text-sm text-slate-500">
        Messages from buyers interested in your listings.
      </p>

      <div className="mt-6 space-y-3">
        {inquiries.map((inquiry) => (
          <InquiryRow
            key={inquiry.id}
            inquiry={{
              id: inquiry.id,
              status: inquiry.status,
              name: inquiry.name,
              email: inquiry.email,
              phone: inquiry.phone,
              message: inquiry.message,
              createdAt: inquiry.createdAt.toISOString(),
              listing: inquiry.listing,
            }}
          />
        ))}
        {inquiries.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            No inquiries yet.
          </p>
        )}
      </div>
    </div>
  );
}

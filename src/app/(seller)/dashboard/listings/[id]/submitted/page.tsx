import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getListingForEdit } from "@/server/services/listing-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";

export const metadata = { title: "Listing Submitted" };

// Shown right after a seller clicks "Submit" on the Add New Car form —
// getListingForEdit is only used here to ownership-check `id` (same as the
// edit page), not because this page needs the listing's data.
export default async function ListingSubmittedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await getListingForEdit(id);
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-slate-900">
          Listing submitted for review — an admin will review it shortly.
        </p>
        <Link
          href={`/dashboard/listings/${id}/edit`}
          className="mt-6 inline-block rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          Edit Listing
        </Link>
      </div>
    </div>
  );
}

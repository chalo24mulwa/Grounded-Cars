import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getListingForEdit, getLatestRejectionReason } from "@/server/services/listing-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { waitForNewListing } from "@/server/services/listing-fast-submit";
import { ListingForm } from "@/components/dashboard/ListingForm";
import { ImageManager } from "@/components/dashboard/ImageManager";

export const metadata = { title: "Edit Car Listing" };

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  let listing;
  try {
    try {
      listing = await getListingForEdit(id);
    } catch (error) {
      // Just saved as a draft with the fast form: it may still be being
      // written in the background, so wait for it before giving up.
      if (!created || !(error instanceof AuthorizationError)) throw error;
      await waitForNewListing(id);
      listing = await getListingForEdit(id);
    }
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    // Ownership failure renders as "not found," not "forbidden" — this is
    // deliberate: it doesn't confirm to Seller B that Seller A's listing ID
    // even exists, rather than just refusing to show it.
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }

  // Only DRAFT listings can carry a live rejection reason worth surfacing —
  // once resubmitted (PENDING) or approved (ACTIVE) it's history, not action
  // the seller still needs to take.
  const rejectionReason =
    listing.status === "DRAFT" ? await getLatestRejectionReason(listing.id) : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Edit Car Listing</h1>
        <Link href="/dashboard/listings" className="text-sm font-medium text-brand hover:underline">
          ← Back to My Cars
        </Link>
      </div>

      {created && (
        <p className="mt-4 rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">
          Draft saved — you can keep editing and submit it for review when you&apos;re ready.
        </p>
      )}

      {rejectionReason && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-red-700">Changes requested by admin</p>
          <p className="mt-0.5 text-sm text-red-600">{rejectionReason}</p>
          <p className="mt-1 text-xs text-red-500">
            Update the listing to address this, then submit it for review again.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Photos</h2>
        <ImageManager listingId={listing.id} images={listing.images} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <ListingForm
          mode="edit"
          listingId={listing.id}
          defaults={{
            title: listing.title,
            make: listing.make,
            model: listing.model,
            year: listing.year,
            price: listing.price.toString(),
            currency: listing.currency,
            mileage: listing.mileage,
            transmission: listing.transmission,
            fuelType: listing.fuelType,
            engineSize: listing.engineSize,
            bodyType: listing.bodyType,
            color: listing.color,
            location: listing.location,
            description: listing.description,
            condition: listing.condition,
            importStatus: listing.importStatus,
            category: listing.category,
          }}
        />
      </div>
    </div>
  );
}

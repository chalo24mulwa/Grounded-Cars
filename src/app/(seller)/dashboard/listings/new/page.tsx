import { ListingForm } from "@/components/dashboard/ListingForm";

export const metadata = { title: "Add New Car" };

export default function NewListingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Add New Car</h1>
      <p className="mt-1 text-sm text-slate-500">
        Add photos and details, then Submit to send it for review — or Save as Draft to finish it
        later.
      </p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <ListingForm mode="create" />
      </div>
    </div>
  );
}

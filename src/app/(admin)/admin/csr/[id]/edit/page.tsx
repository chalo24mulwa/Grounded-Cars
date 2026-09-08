import Link from "next/link";
import { notFound } from "next/navigation";
import { getCsrInitiativeForAdmin, InitiativeNotFoundError } from "@/server/services/csr-service";
import { CsrInitiativeForm } from "@/components/admin/CsrInitiativeForm";
import { CsrGalleryManager } from "@/components/admin/CsrGalleryManager";

export const metadata = { title: "Edit CSR Initiative" };

// "YYYY-MM-DD" for the <input type="date"> defaultValue — same helper as
// EditEventPage, avoids a timezone-shifted off-by-one day some
// locale-based formatters would introduce.
function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function EditCsrInitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let initiative;
  try {
    initiative = await getCsrInitiativeForAdmin(id);
  } catch (error) {
    if (error instanceof InitiativeNotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Edit CSR Initiative</h1>
        <Link href="/admin/csr" className="text-sm font-medium text-brand hover:underline">
          ← Back to CSR Initiatives
        </Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <CsrInitiativeForm
          mode="edit"
          initiativeId={initiative.id}
          currentCoverImageUrl={initiative.coverImageUrl}
          defaults={{
            title: initiative.title,
            summary: initiative.summary,
            story: initiative.story,
            targetAmount: String(Number(initiative.targetAmount)),
            startDate: toDateInputValue(initiative.startDate),
            endDate: toDateInputValue(initiative.endDate),
          }}
        />
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Gallery photos</h2>
        <p className="mt-1 text-sm text-slate-500">Additional photos shown alongside the cover photo on the public page.</p>
        <div className="mt-4">
          <CsrGalleryManager initiativeId={initiative.id} images={initiative.images} />
        </div>
      </div>
    </div>
  );
}

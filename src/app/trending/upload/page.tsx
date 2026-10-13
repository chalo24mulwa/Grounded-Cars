import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerProfile } from "@/server/services/trending/profile-service";
import { getMyLinkableListings } from "@/server/services/trending/video-service";
import { isMuxConfigured } from "@/lib/trending/mux";
import { UploadForm } from "@/components/trending/UploadForm";

export const metadata: Metadata = { title: "Upload a car video", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TrendingUploadPage() {
  const me = await getViewerProfile();
  if (!me) redirect(`/login?callbackUrl=${encodeURIComponent("/trending/upload")}`);
  const listings = await getMyLinkableListings();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">Upload a car video</h1>
      <p className="mt-1 text-sm text-slate-600">
        Up to 60 minutes. Your video is resized automatically so it plays fast on every phone, and it&apos;s removed
        automatically 7 days after you post it.
      </p>
      {me.postingSuspended ? (
        <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">Posting videos has been turned off for your account.</p>
      ) : !isMuxConfigured() ? (
        <p className="mt-6 rounded-md bg-amber-50 p-4 text-sm text-amber-800">Video uploads aren&apos;t set up yet. Please check back soon.</p>
      ) : (
        <UploadForm
          listings={listings.map((l) => ({
            id: l.id,
            label: l.title,
            make: l.make,
            model: l.model,
            year: l.year,
            price: Number(l.price),
            location: l.location,
          }))}
        />
      )}
    </div>
  );
}

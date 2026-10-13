import { notFound, redirect } from "next/navigation";
import { getMyVideoForEdit } from "@/server/services/trending/video-service";
import { getViewerProfile } from "@/server/services/trending/profile-service";
import { EditVideoForm } from "@/components/trending/EditVideoForm";

export const dynamic = "force-dynamic";

export default async function EditTrendingVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getViewerProfile();
  if (!me) redirect(`/login?callbackUrl=${encodeURIComponent(`/trending/edit/${id}`)}`);
  const video = await getMyVideoForEdit(id);
  if (!video) notFound();
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">Edit video</h1>
      <EditVideoForm id={video.id} caption={video.caption} title={video.title ?? ""} />
    </div>
  );
}

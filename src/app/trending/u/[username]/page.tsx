import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfileByUsername, getViewerProfile, getBlockedProfileIds } from "@/server/services/trending/profile-service";
import { listProfileVideos, getProfileStats } from "@/server/services/trending/video-service";
import { Avatar, formatCount, expiresIn } from "@/components/trending/ui";
import { ProfileActions } from "@/components/trending/ProfileActions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) return { title: "Profile not found", robots: { index: false } };
  return { title: `${profile.displayName} (@${profile.username}) — Trending`, description: profile.bio ?? undefined };
}

export default async function TrendingProfilePage({ params }: Props) {
  const { username } = await params;
  const [profile, viewer] = await Promise.all([getProfileByUsername(decodeURIComponent(username)), getViewerProfile()]);
  if (!profile) notFound();

  const isOwner = viewer?.id === profile.id;
  const blockedIds = await getBlockedProfileIds(viewer?.id);
  const isBlocked = blockedIds.includes(profile.id);
  const [videos, stats] = await Promise.all([isBlocked ? Promise.resolve([]) : listProfileVideos(profile.id), getProfileStats(profile.id)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-col items-center text-center">
        <Avatar src={profile.avatarUrl} name={profile.displayName} size={96} />
        <h1 className="mt-3 text-xl font-bold text-slate-900">{profile.displayName}</h1>
        <p className="text-sm text-slate-500">@{profile.username}</p>
        <div className="mt-3 flex gap-6 text-sm">
          <span>
            <strong className="text-slate-900">{formatCount(stats.videos)}</strong> <span className="text-slate-500">{stats.videos === 1 ? "video" : "videos"}</span>
          </span>
          <span>
            <strong className="text-slate-900">{formatCount(stats.likes)}</strong> <span className="text-slate-500">{stats.likes === 1 ? "like" : "likes"}</span>
          </span>
        </div>
        {profile.bio && <p className="mt-3 max-w-md whitespace-pre-wrap text-sm text-slate-700">{profile.bio}</p>}
        <div className="mt-4">
          {isOwner ? (
            <div className="flex gap-2">
              <Link href="/trending/settings" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
                Edit profile
              </Link>
              <Link href="/trending/upload" className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
                Upload video
              </Link>
            </div>
          ) : (
            <ProfileActions profileId={profile.id} username={profile.username} signedIn={Boolean(viewer)} blocked={isBlocked} />
          )}
        </div>
      </div>

      {isOwner && (
        <p className="mt-6 rounded-md bg-brand-subtle px-3 py-2 text-center text-xs text-slate-700">
          Videos are removed automatically 7 days after you post them.
        </p>
      )}

      {videos.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-500">
          {isBlocked ? "You've blocked this account." : isOwner ? "You haven't posted any videos yet." : "No videos right now."}
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-1 sm:gap-2">
          {videos.map((v) => (
            <li key={v.id}>
              <Link href={`/trending/v/${v.id}`} className="relative block aspect-[9/16] overflow-hidden rounded-md bg-slate-800">
                {v.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                )}
                {v.status !== "READY" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 px-2 text-center text-xs font-semibold text-white">
                    {v.status === "FAILED" ? "Couldn't publish" : "Processing…"}
                  </span>
                )}
                <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[11px] font-semibold text-white">♥ {formatCount(v.likeCount)}</span>
                {isOwner && (
                  <span className="absolute right-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white">{expiresIn(v.expiresAt).replace("Expires in ", "")}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

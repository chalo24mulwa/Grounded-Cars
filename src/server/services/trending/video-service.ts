import "server-only";
import { Prisma, type TrendingVideoStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/server/services/rate-limit";
import { saveTrendingImage, deleteTrendingImage } from "@/lib/storage";
import {
  CAPTION_MAX,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  thumbnailUrl,
  videoTtlHours,
} from "@/lib/trending/config";
import {
  createDirectUpload,
  getAsset,
  getUpload,
  isMuxConfigured,
  type MuxAsset,
} from "@/lib/trending/mux";
import {
  requireMyProfile,
  getViewerProfile,
  getBlockedProfileIds,
  TrendingError,
} from "@/server/services/trending/profile-service";
import { purgeVideo } from "@/server/services/trending/cleanup-service";

// Only READY, unexpired videos are ever shown to anyone but their owner. The
// expiry check is part of every query, so a video disappears the moment its
// 7 days are up — before the cleanup job has even run.
function visibleWhere(now = new Date()): Prisma.TrendingVideoWhereInput {
  return { status: "READY", expiresAt: { gt: now }, removedByAdmin: false };
}

const VIDEO_INCLUDE = {
  profile: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  listing: { select: { slug: true, title: true, status: true } },
} satisfies Prisma.TrendingVideoInclude;

type VideoRow = Prisma.TrendingVideoGetPayload<{ include: typeof VIDEO_INCLUDE }>;

export type FeedVideo = {
  id: string;
  playbackId: string | null;
  poster: string | null;
  title: string | null;
  caption: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  location: string | null;
  listing: { slug: string; title: string } | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  isMine: boolean;
  expiresAt: string;
  createdAt: string;
  status: TrendingVideoStatus;
  failureReason: string | null;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null };
};

function toFeedVideo(row: VideoRow, viewerProfileId: string | null, likedIds: Set<string>): FeedVideo {
  return {
    id: row.id,
    playbackId: row.muxPlaybackId,
    poster: row.coverUrl ?? (row.muxPlaybackId ? thumbnailUrl(row.muxPlaybackId) : null),
    title: row.title,
    caption: row.caption,
    make: row.make,
    model: row.model,
    year: row.year,
    price: row.price,
    location: row.location,
    // Only show the linked listing while it's publicly visible.
    listing:
      row.listing && (row.listing.status === "ACTIVE" || row.listing.status === "SOLD")
        ? { slug: row.listing.slug, title: row.listing.title }
        : null,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    shareCount: row.shareCount,
    likedByMe: likedIds.has(row.id),
    isMine: row.profileId === viewerProfileId,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    failureReason: row.failureReason,
    author: row.profile,
  };
}

async function likedVideoIds(profileId: string | null, videoIds: string[]): Promise<Set<string>> {
  if (!profileId || videoIds.length === 0) return new Set();
  const likes = await prisma.trendingVideoLike.findMany({
    where: { profileId, videoId: { in: videoIds } },
    select: { videoId: true },
  });
  return new Set(likes.map((like) => like.videoId));
}

// ---------------------------------------------------------------------------
// Feed / pages
// ---------------------------------------------------------------------------

const FEED_PAGE_SIZE = 6;

/** Newest first; `cursor` is the last video id of the previous page. */
export async function listFeed(cursor?: string | null): Promise<{ videos: FeedVideo[]; nextCursor: string | null }> {
  const viewer = await getViewerProfile();
  const blocked = await getBlockedProfileIds(viewer?.id);
  const rows = await prisma.trendingVideo.findMany({
    where: { ...visibleWhere(), ...(blocked.length ? { profileId: { notIn: blocked } } : {}) },
    include: VIDEO_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const liked = await likedVideoIds(viewer?.id ?? null, page.map((row) => row.id));
  return {
    videos: page.map((row) => toFeedVideo(row, viewer?.id ?? null, liked)),
    nextCursor: rows.length > FEED_PAGE_SIZE ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export type VideoPageResult =
  | { state: "ok"; video: FeedVideo }
  | { state: "processing"; video: FeedVideo }
  | { state: "gone" };

/** A single video for /trending/v/[id]. Anything expired, deleted, removed
 * or unknown is reported as "gone" — the page then shows the friendly
 * "This video has expired" message instead of an error. */
export async function getVideoForPage(id: string): Promise<VideoPageResult> {
  const viewer = await getViewerProfile();
  const row = await prisma.trendingVideo.findUnique({ where: { id }, include: VIDEO_INCLUDE });
  if (!row || row.removedByAdmin || row.expiresAt <= new Date() || row.status === "EXPIRED") return { state: "gone" };
  const blocked = await getBlockedProfileIds(viewer?.id);
  if (blocked.includes(row.profileId)) return { state: "gone" };
  const liked = await likedVideoIds(viewer?.id ?? null, [row.id]);
  const video = toFeedVideo(row, viewer?.id ?? null, liked);
  if (row.status === "READY") return { state: "ok", video };
  if (row.profileId === viewer?.id) return { state: "processing", video };
  return { state: "gone" };
}

/** A profile's videos. The owner also sees their videos still processing or
 * that failed, so they know what happened. */
export async function listProfileVideos(profileId: string): Promise<FeedVideo[]> {
  const viewer = await getViewerProfile();
  const isOwner = viewer?.id === profileId;
  const rows = await prisma.trendingVideo.findMany({
    where: isOwner
      ? { profileId, expiresAt: { gt: new Date() }, status: { not: "EXPIRED" }, removedByAdmin: false }
      : { profileId, ...visibleWhere() },
    include: VIDEO_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const liked = await likedVideoIds(viewer?.id ?? null, rows.map((row) => row.id));
  return rows.map((row) => toFeedVideo(row, viewer?.id ?? null, liked));
}

export async function getProfileStats(profileId: string) {
  const now = new Date();
  const agg = await prisma.trendingVideo.aggregate({
    where: { profileId, ...visibleWhere(now) },
    _count: { _all: true },
    _sum: { likeCount: true },
  });
  return { videos: agg._count._all, likes: agg._sum.likeCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export type CreateUploadInput = {
  title?: string;
  caption: string;
  make?: string;
  model?: string;
  year?: number | null;
  price?: number | null;
  location?: string;
  listingId?: string | null;
  durationSeconds: number;
  fileSize: number;
};

const optionalText = (value: string | undefined, max: number) => {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (text.length > max) throw new TrendingError(`Please keep that under ${max} characters.`);
  return text || null;
};

/**
 * Creates the video record and a one-time Mux upload URL. The browser then
 * uploads the file straight to Mux (resumable, in chunks) — the video never
 * passes through this server. The 60-minute limit is checked here from the
 * browser's reading of the file AND again on the server once Mux reports the
 * real duration (see applyMuxState), so it can't be bypassed.
 */
export async function createVideoUpload(input: CreateUploadInput, cover: File | null, corsOrigin: string) {
  const me = await requireMyProfile();
  if (me.postingSuspended) throw new TrendingError("Posting videos has been turned off for your account.");
  if (!isMuxConfigured()) throw new TrendingError("Video uploads aren't set up yet. Please try again later.");
  checkRateLimit(`trending:upload:${me.id}`, { max: 10, windowMs: 60 * 60_000 });

  const caption = (input.caption ?? "").trim();
  if (caption.length < 1) throw new TrendingError("Please add a caption.");
  if (caption.length > CAPTION_MAX) throw new TrendingError(`Captions can be up to ${CAPTION_MAX} characters.`);
  // The browser's reading of the length is a fast first check only (0 = it
  // couldn't read it, e.g. some phone formats). The length Mux measures after
  // upload is the one that's enforced — see applyAsset.
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
    throw new TrendingError("That file doesn't look like a playable video.");
  }
  if (input.durationSeconds > MAX_VIDEO_SECONDS + 1) throw new TrendingError("Videos can be up to 60 minutes long.");
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0 || input.fileSize > MAX_VIDEO_BYTES) {
    throw new TrendingError("That video file is too large.");
  }
  const year = input.year ?? null;
  if (year != null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1)) {
    throw new TrendingError("Please enter a valid year.");
  }
  const price = input.price ?? null;
  if (price != null && (!Number.isInteger(price) || price < 0 || price > 2_000_000_000)) {
    throw new TrendingError("Please enter a valid price.");
  }

  // A linked listing must be one of the poster's own.
  let listingId: string | null = null;
  if (input.listingId) {
    const listing = await prisma.carListing.findFirst({
      where: { id: input.listingId, sellerId: me.userId },
      select: { id: true },
    });
    if (!listing) throw new TrendingError("You can only link your own listings.");
    listingId = listing.id;
  }

  const coverImage = cover && cover.size > 0 ? await saveTrendingImage("covers", cover) : null;

  const video = await prisma.trendingVideo.create({
    data: {
      profileId: me.id,
      title: optionalText(input.title, 100),
      caption,
      make: optionalText(input.make, 40),
      model: optionalText(input.model, 40),
      year,
      price,
      location: optionalText(input.location, 60),
      listingId,
      coverUrl: coverImage?.imageUrl ?? null,
      coverKey: coverImage?.storageKey ?? null,
      expiresAt: new Date(Date.now() + videoTtlHours() * 60 * 60_000),
    },
    select: { id: true },
  });

  try {
    const upload = await createDirectUpload(video.id, corsOrigin);
    await prisma.trendingVideo.update({ where: { id: video.id }, data: { muxUploadId: upload.id } });
    return { videoId: video.id, uploadUrl: upload.url };
  } catch (error) {
    await prisma.trendingVideo.delete({ where: { id: video.id } }).catch(() => undefined);
    await deleteTrendingImage(coverImage?.storageKey);
    throw error;
  }
}

/** Applies Mux's current view of an asset to our record: READY when it has
 * finished processing (unless it's over 60 minutes — then it's deleted at
 * Mux and marked FAILED), FAILED on an encoding error. */
async function applyAsset(videoId: string, asset: MuxAsset) {
  if (asset.status === "ready") {
    if ((asset.duration ?? 0) > MAX_VIDEO_SECONDS + 1) {
      await prisma.trendingVideo.update({
        where: { id: videoId },
        data: { status: "FAILED", failureReason: "This video is longer than 60 minutes.", muxAssetId: asset.id },
      });
      // Free the space at Mux right away; the cleanup job retries if this fails.
      await purgeVideo(videoId, { keepRecord: true }).catch((error) =>
        console.error("Failed to remove over-length video from Mux:", error)
      );
      return;
    }
    const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id ?? asset.playback_ids?.[0]?.id;
    await prisma.trendingVideo.update({
      where: { id: videoId },
      data: {
        status: playbackId ? "READY" : "FAILED",
        muxAssetId: asset.id,
        muxPlaybackId: playbackId ?? null,
        durationSeconds: asset.duration ?? null,
        aspectRatio: asset.aspect_ratio ?? null,
        failureReason: playbackId ? null : "Video processing failed.",
      },
    });
  } else if (asset.status === "errored") {
    await prisma.trendingVideo.update({
      where: { id: videoId },
      data: { status: "FAILED", muxAssetId: asset.id, failureReason: "We couldn't process this video file." },
    });
  } else {
    await prisma.trendingVideo.update({ where: { id: videoId }, data: { status: "PROCESSING", muxAssetId: asset.id } });
  }
}

/** Brings one video's status up to date by asking Mux. Used by the webhook and
 * by the uploader's status polling, so things work even if the webhook is
 * delayed or not configured yet. */
export async function syncVideoWithMux(videoId: string): Promise<TrendingVideoStatus | null> {
  const video = await prisma.trendingVideo.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, muxUploadId: true, muxAssetId: true },
  });
  if (!video) return null;
  if (video.status === "READY" || video.status === "FAILED" || video.status === "EXPIRED") return video.status;

  let assetId = video.muxAssetId;
  if (!assetId && video.muxUploadId) {
    const upload = await getUpload(video.muxUploadId);
    if (!upload || upload.status === "errored" || upload.status === "cancelled" || upload.status === "timed_out") {
      await prisma.trendingVideo.update({
        where: { id: video.id },
        data: { status: "FAILED", failureReason: upload?.error?.message ?? "The upload didn't finish." },
      });
      return "FAILED";
    }
    assetId = upload.asset_id ?? null;
  }
  if (!assetId) return video.status;

  const asset = await getAsset(assetId);
  if (!asset) {
    await prisma.trendingVideo.update({
      where: { id: video.id },
      data: { status: "FAILED", failureReason: "Video processing failed." },
    });
    return "FAILED";
  }
  await applyAsset(video.id, asset);
  const updated = await prisma.trendingVideo.findUnique({ where: { id: video.id }, select: { status: true } });
  return updated?.status ?? null;
}

/** Matches a (signature-verified) Mux webhook to our video, then re-reads the
 * state from Mux's API rather than trusting the payload's contents. */
export async function handleMuxWebhookEvent(event: {
  type?: string;
  data?: { id?: string; passthrough?: string; upload_id?: string; asset_id?: string; new_asset_settings?: { passthrough?: string } };
}) {
  const data = event.data ?? {};
  const candidates: Prisma.TrendingVideoWhereInput[] = [];
  const passthrough = data.passthrough ?? data.new_asset_settings?.passthrough;
  if (passthrough) candidates.push({ id: passthrough });
  if (data.upload_id) candidates.push({ muxUploadId: data.upload_id });
  if (data.id) candidates.push({ muxUploadId: data.id }, { muxAssetId: data.id });
  if (data.asset_id) candidates.push({ muxAssetId: data.asset_id });
  if (candidates.length === 0) return;

  const video = await prisma.trendingVideo.findFirst({ where: { OR: candidates }, select: { id: true, muxAssetId: true } });
  if (!video) return;
  if (!video.muxAssetId && data.asset_id) {
    await prisma.trendingVideo.update({ where: { id: video.id }, data: { muxAssetId: data.asset_id, status: "PROCESSING" } });
  }
  await syncVideoWithMux(video.id);
}

/** Upload-page polling: the owner's view of their video's progress. */
export async function getMyVideoStatus(videoId: string) {
  const me = await requireMyProfile();
  const video = await prisma.trendingVideo.findFirst({ where: { id: videoId, profileId: me.id }, select: { id: true } });
  if (!video) throw new TrendingError("Video not found.");
  const status = await syncVideoWithMux(video.id);
  const row = await prisma.trendingVideo.findUnique({ where: { id: video.id }, select: { failureReason: true } });
  return { status, failureReason: row?.failureReason ?? null };
}

// ---------------------------------------------------------------------------
// Owner actions / counters
// ---------------------------------------------------------------------------

async function requireOwnVideo(videoId: string) {
  const me = await requireMyProfile();
  const video = await prisma.trendingVideo.findFirst({
    where: { id: videoId, profileId: me.id, status: { not: "EXPIRED" } },
    select: { id: true },
  });
  if (!video) throw new TrendingError("Video not found.");
  return video;
}

export async function updateMyVideo(videoId: string, input: { caption: string; title?: string }) {
  await requireOwnVideo(videoId);
  const caption = input.caption.trim();
  if (caption.length < 1 || caption.length > CAPTION_MAX) {
    throw new TrendingError(`Captions must be 1-${CAPTION_MAX} characters.`);
  }
  await prisma.trendingVideo.update({
    where: { id: videoId },
    data: { caption, title: optionalText(input.title, 100) },
  });
}

/** Deletes everything about the video right away (same as the 7-day cleanup).
 * If Mux can't be reached the video is already hidden and the cleanup job
 * finishes the deletion on its next run. */
export async function deleteMyVideo(videoId: string) {
  await requireOwnVideo(videoId);
  await prisma.trendingVideo.update({ where: { id: videoId }, data: { status: "EXPIRED", expiresAt: new Date() } });
  await purgeVideo(videoId).catch((error) => console.error("Immediate video deletion failed; cleanup will retry:", error));
}

export async function recordView(videoId: string) {
  await prisma.trendingVideo
    .updateMany({ where: { id: videoId, ...visibleWhere() }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

export async function recordShare(videoId: string) {
  await prisma.trendingVideo
    .updateMany({ where: { id: videoId, ...visibleWhere() }, data: { shareCount: { increment: 1 } } })
    .catch(() => undefined);
}

/** The signed-in user's own public listings, for the "link a listing" picker. */
export async function getMyLinkableListings() {
  const me = await requireMyProfile();
  return prisma.carListing.findMany({
    where: { sellerId: me.userId, status: { in: ["ACTIVE", "SOLD"] } },
    select: { id: true, title: true, make: true, model: true, year: true, price: true, location: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export { visibleWhere };

/** The owner's own video, for the edit page (null if not theirs / gone). */
export async function getMyVideoForEdit(videoId: string) {
  const me = await requireMyProfile();
  return prisma.trendingVideo.findFirst({
    where: { id: videoId, profileId: me.id, status: { not: "EXPIRED" } },
    select: { id: true, caption: true, title: true },
  });
}

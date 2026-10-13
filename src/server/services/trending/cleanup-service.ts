import "server-only";
import { prisma } from "@/lib/prisma";
import { deleteAsset, cancelUpload, isMuxConfigured } from "@/lib/trending/mux";
import { deleteTrendingImage } from "@/lib/storage";
import { isTrendingEnabled } from "@/lib/trending/config";

// The 7-day lifetime of Trending videos. Every video is hidden the moment its
// expiresAt passes (every query checks it); this job then deletes it
// everywhere so the space is actually freed:
//   1. at Mux — the asset (every resized version, thumbnails, the stored
//      master; no downloadable MP4s are ever created), or the unfinished
//      upload — FIRST, so nothing is ever left orphaned at Mux;
//   2. its custom cover image on this server's disk;
//   3. its database rows — the video plus, by cascade, its likes, comments,
//      replies and comment likes. Messages are never touched (they hold only
//      a plain id reference to the video).
// If step 1 fails the row stays (status EXPIRED, hidden) and is retried on the
// next run. Running it twice is harmless. It only ever touches Trending tables.

const BATCH_SIZE = 25;

/**
 * Deletes one video completely. `keepRecord` keeps a FAILED video's row (so
 * the owner can see why it failed) while still freeing everything at Mux.
 */
export async function purgeVideo(videoId: string, { keepRecord = false }: { keepRecord?: boolean } = {}) {
  const video = await prisma.trendingVideo.findUnique({
    where: { id: videoId },
    select: { id: true, muxAssetId: true, muxUploadId: true, coverKey: true, durationSeconds: true },
  });
  if (!video) return { removed: false, minutes: 0 };

  if (video.muxAssetId || video.muxUploadId) {
    if (!isMuxConfigured()) throw new Error("Mux credentials are not configured; cannot delete the video there.");
    if (video.muxAssetId) await deleteAsset(video.muxAssetId);
    else if (video.muxUploadId) await cancelUpload(video.muxUploadId);
  }

  if (keepRecord) {
    await prisma.trendingVideo.update({
      where: { id: video.id },
      data: { muxAssetId: null, muxUploadId: null, muxPlaybackId: null },
    });
    return { removed: false, minutes: (video.durationSeconds ?? 0) / 60 };
  }

  await deleteTrendingImage(video.coverKey);
  // Reports about this video (and about its comments) are closed, not deleted.
  const commentIds = await prisma.trendingComment.findMany({ where: { videoId: video.id }, select: { id: true } });
  await prisma.$transaction([
    prisma.trendingReport.updateMany({
      where: {
        status: "OPEN",
        OR: [
          { targetType: "VIDEO", targetId: video.id },
          ...(commentIds.length ? [{ targetType: "COMMENT" as const, targetId: { in: commentIds.map((c) => c.id) } }] : []),
        ],
      },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    }),
    prisma.trendingVideo.delete({ where: { id: video.id } }),
  ]);
  return { removed: true, minutes: (video.durationSeconds ?? 0) / 60 };
}

export type TrendingCleanupResult = {
  ranAt: string;
  removed: number;
  failed: number;
  freedMinutes: number;
  skipped?: string;
};

/** Finds expired videos (and failed ones older than a day) and deletes them. */
export async function runTrendingCleanup(): Promise<TrendingCleanupResult> {
  const ranAt = new Date();
  if (!isTrendingEnabled()) return { ranAt: ranAt.toISOString(), removed: 0, failed: 0, freedMinutes: 0, skipped: "disabled" };

  let removed = 0;
  let failed = 0;
  let freedMinutes = 0;
  const attempted = new Set<string>();
  const staleFailedBefore = new Date(ranAt.getTime() - 24 * 60 * 60_000);

  for (let round = 0; round < 40; round++) {
    const batch = await prisma.trendingVideo.findMany({
      where: {
        id: { notIn: [...attempted] },
        OR: [
          { expiresAt: { lte: ranAt } },
          { status: "EXPIRED" },
          // Abandoned or rejected uploads don't need to wait 7 days.
          { status: { in: ["FAILED", "UPLOADING"] }, createdAt: { lte: staleFailedBefore } },
        ],
      },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    for (const { id } of batch) {
      attempted.add(id);
      try {
        // Hide first, so a half-finished deletion is never visible.
        await prisma.trendingVideo.updateMany({ where: { id, status: { not: "EXPIRED" } }, data: { status: "EXPIRED" } });
        const result = await purgeVideo(id);
        if (result.removed) {
          removed++;
          freedMinutes += result.minutes;
        }
      } catch (error) {
        failed++;
        console.error(`[trending-cleanup] could not delete video ${id}, will retry next run:`, error);
      }
    }
  }

  if (removed || failed) {
    console.log(
      `[trending-cleanup] removed ${removed} video(s), freed ~${freedMinutes.toFixed(1)} stored minutes at Mux` +
        (failed ? `, ${failed} failed (will retry)` : "")
    );
  }
  return { ranAt: ranAt.toISOString(), removed, failed, freedMinutes: Math.round(freedMinutes * 10) / 10 };
}

/** Numbers for the admin storage panel. */
export async function getTrendingStorageStats() {
  const now = new Date();
  const [live, processing, pending, minutes] = await Promise.all([
    prisma.trendingVideo.count({ where: { status: "READY", expiresAt: { gt: now }, removedByAdmin: false } }),
    prisma.trendingVideo.count({ where: { status: { in: ["UPLOADING", "PROCESSING"] }, expiresAt: { gt: now } } }),
    prisma.trendingVideo.count({ where: { OR: [{ expiresAt: { lte: now } }, { status: "EXPIRED" }] } }),
    prisma.trendingVideo.aggregate({ where: { muxAssetId: { not: null } }, _sum: { durationSeconds: true } }),
  ]);
  return {
    liveVideos: live,
    processingVideos: processing,
    awaitingDeletion: pending,
    storedMinutes: Math.round(((minutes._sum.durationSeconds ?? 0) / 60) * 10) / 10,
  };
}

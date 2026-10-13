import "server-only";
import type { TrendingReportTarget, TrendingReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/server/services/rate-limit";
import { requireRole } from "@/server/authorization/ownership";
import { recordAuditLog } from "@/server/services/audit-service";
import { requireMyProfile, TrendingError, assertTrendingEnabled } from "@/server/services/trending/profile-service";
import { purgeVideo } from "@/server/services/trending/cleanup-service";
import { removeCommentCompletely } from "@/server/services/trending/interaction-service";

export const REPORT_REASONS = [
  "Spam or scam",
  "Nudity or sexual content",
  "Violence or dangerous acts",
  "Hate or harassment",
  "Misleading car information",
  "Not about cars",
  "Other",
] as const;

export async function createReport(targetType: TrendingReportTarget, targetId: string, reason: string, details?: string) {
  const me = await requireMyProfile();
  checkRateLimit(`trending:report:${me.id}`, { max: 20, windowMs: 60 * 60_000 });
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw new TrendingError("Please choose a reason.");
  const exists =
    targetType === "VIDEO"
      ? await prisma.trendingVideo.count({ where: { id: targetId } })
      : targetType === "COMMENT"
        ? await prisma.trendingComment.count({ where: { id: targetId } })
        : await prisma.trendingProfile.count({ where: { id: targetId } });
  if (!exists) throw new TrendingError("That content no longer exists.");
  const already = await prisma.trendingReport.count({ where: { reporterId: me.id, targetType, targetId, status: "OPEN" } });
  if (already) return;
  await prisma.trendingReport.create({
    data: { reporterId: me.id, targetType, targetId, reason, details: details?.trim().slice(0, 500) || null },
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function requireAdmin() {
  assertTrendingEnabled();
  return requireRole("ADMIN");
}

export async function listReports(status: TrendingReportStatus = "OPEN") {
  await requireAdmin();
  const reports = await prisma.trendingReport.findMany({
    where: { status },
    include: { reporter: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Fetch the reported things in bulk for context.
  const ids = (type: TrendingReportTarget) => reports.filter((r) => r.targetType === type).map((r) => r.targetId);
  const [videos, comments, profiles] = await Promise.all([
    prisma.trendingVideo.findMany({
      where: { id: { in: ids("VIDEO") } },
      select: { id: true, caption: true, status: true, removedByAdmin: true, profile: { select: { id: true, username: true } } },
    }),
    prisma.trendingComment.findMany({
      where: { id: { in: ids("COMMENT") } },
      select: { id: true, body: true, videoId: true, author: { select: { id: true, username: true } } },
    }),
    prisma.trendingProfile.findMany({
      where: { id: { in: ids("PROFILE") } },
      select: { id: true, username: true, displayName: true, postingSuspended: true },
    }),
  ]);
  const v = new Map(videos.map((x) => [x.id, x]));
  const c = new Map(comments.map((x) => [x.id, x]));
  const p = new Map(profiles.map((x) => [x.id, x]));
  return reports.map((r) => ({
    ...r,
    video: r.targetType === "VIDEO" ? (v.get(r.targetId) ?? null) : null,
    comment: r.targetType === "COMMENT" ? (c.get(r.targetId) ?? null) : null,
    profile: r.targetType === "PROFILE" ? (p.get(r.targetId) ?? null) : null,
  }));
}

export async function setReportStatus(reportId: string, status: "RESOLVED" | "DISMISSED") {
  const admin = await requireAdmin();
  await prisma.trendingReport.update({
    where: { id: reportId },
    data: { status, resolvedAt: new Date(), resolvedById: admin.id },
  });
}

/** Removes a video for everyone and deletes it completely (as the 7-day
 * cleanup would), closing its reports. */
export async function adminRemoveVideo(videoId: string) {
  const admin = await requireAdmin();
  await prisma.trendingVideo.update({
    where: { id: videoId },
    data: { removedByAdmin: true, status: "EXPIRED", expiresAt: new Date() },
  });
  await recordAuditLog(admin.id, "TRENDING_VIDEO_REMOVED", "TrendingVideo", videoId).catch(() => undefined);
  await purgeVideo(videoId).catch((error) => console.error("Admin video removal: cleanup will retry:", error));
}

export async function adminDeleteComment(commentId: string) {
  const admin = await requireAdmin();
  const comment = await prisma.trendingComment.findUnique({
    where: { id: commentId },
    select: { id: true, parentId: true, replyCount: true, videoId: true },
  });
  if (comment) await removeCommentCompletely(comment);
  await prisma.trendingReport.updateMany({
    where: { targetType: "COMMENT", targetId: commentId, status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: admin.id },
  });
  await recordAuditLog(admin.id, "TRENDING_COMMENT_REMOVED", "TrendingComment", commentId).catch(() => undefined);
}

export async function adminSetPostingSuspended(profileId: string, suspended: boolean) {
  const admin = await requireAdmin();
  await prisma.trendingProfile.update({ where: { id: profileId }, data: { postingSuspended: suspended } });
  await recordAuditLog(
    admin.id,
    suspended ? "TRENDING_POSTING_SUSPENDED" : "TRENDING_POSTING_RESTORED",
    "TrendingProfile",
    profileId
  ).catch(() => undefined);
}

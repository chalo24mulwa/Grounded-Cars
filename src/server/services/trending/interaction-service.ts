import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/server/services/rate-limit";
import { COMMENT_MAX } from "@/lib/trending/config";
import {
  requireMyProfile,
  getViewerProfile,
  getBlockedProfileIds,
  TrendingError,
} from "@/server/services/trending/profile-service";
import { visibleWhere } from "@/server/services/trending/video-service";

// Likes and comments. Counters on videos/comments are updated in the same
// transaction as the row they count, guarded by the unique (video, profile) /
// (comment, profile) constraints, so double-taps and races can't skew them.

async function requireVisibleVideo(videoId: string) {
  const video = await prisma.trendingVideo.findFirst({ where: { id: videoId, ...visibleWhere() }, select: { id: true, profileId: true } });
  if (!video) throw new TrendingError("This video is no longer available.");
  return video;
}

async function assertNotBlockedBetween(profileId: string, otherProfileId: string) {
  const blocked = await getBlockedProfileIds(profileId);
  if (blocked.includes(otherProfileId)) throw new TrendingError("You can't interact with this account.");
}

export async function setVideoLike(videoId: string, like: boolean) {
  const me = await requireMyProfile();
  checkRateLimit(`trending:like:${me.id}`, { max: 120, windowMs: 60_000 });
  const video = await requireVisibleVideo(videoId);
  await assertNotBlockedBetween(me.id, video.profileId);

  if (like) {
    try {
      await prisma.$transaction([
        prisma.trendingVideoLike.create({ data: { videoId, profileId: me.id } }),
        prisma.trendingVideo.update({ where: { id: videoId }, data: { likeCount: { increment: 1 } } }),
      ]);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  } else {
    const deleted = await prisma.trendingVideoLike.deleteMany({ where: { videoId, profileId: me.id } });
    if (deleted.count > 0) {
      await prisma.trendingVideo.updateMany({ where: { id: videoId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
    }
  }
  const row = await prisma.trendingVideo.findUnique({ where: { id: videoId }, select: { likeCount: true } });
  return { liked: like, likeCount: row?.likeCount ?? 0 };
}

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  canEdit: boolean;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null };
};

const COMMENT_PAGE = 20;

/** Top-level comments (newest first), or the replies to one comment (oldest
 * first, like TikTok's "View N replies"). */
export async function listComments(videoId: string, opts: { parentId?: string | null; cursor?: string | null } = {}) {
  const viewer = await getViewerProfile();
  const video = await requireVisibleVideo(videoId);
  const blocked = await getBlockedProfileIds(viewer?.id);
  const parentId = opts.parentId ?? null;
  const rows = await prisma.trendingComment.findMany({
    where: { videoId, parentId, ...(blocked.length ? { authorId: { notIn: blocked } } : {}) },
    include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    orderBy: parentId ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: COMMENT_PAGE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, COMMENT_PAGE);
  const liked = viewer
    ? new Set(
        (
          await prisma.trendingCommentLike.findMany({
            where: { profileId: viewer.id, commentId: { in: page.map((c) => c.id) } },
            select: { commentId: true },
          })
        ).map((l) => l.commentId)
      )
    : new Set<string>();

  const comments: CommentView[] = page.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    likeCount: c.likeCount,
    replyCount: c.replyCount,
    likedByMe: liked.has(c.id),
    canEdit: viewer?.id === c.authorId,
    // Authors can delete their own comments; the video's owner can delete any
    // comment on their video.
    canDelete: viewer != null && (viewer.id === c.authorId || viewer.id === video.profileId),
    author: c.author,
  }));
  return { comments, nextCursor: rows.length > COMMENT_PAGE ? (page[page.length - 1]?.id ?? null) : null };
}

function cleanBody(body: string) {
  const text = body.trim();
  if (text.length < 1) throw new TrendingError("Write something first.");
  if (text.length > COMMENT_MAX) throw new TrendingError(`Comments can be up to ${COMMENT_MAX} characters.`);
  return text;
}

export async function addComment(videoId: string, body: string, parentId?: string | null) {
  const me = await requireMyProfile();
  checkRateLimit(`trending:comment:${me.id}`, { max: 20, windowMs: 60_000 });
  checkRateLimit(`trending:comment-hour:${me.id}`, { max: 200, windowMs: 60 * 60_000 });
  const video = await requireVisibleVideo(videoId);
  await assertNotBlockedBetween(me.id, video.profileId);
  const text = cleanBody(body);

  let rootId: string | null = null;
  if (parentId) {
    // Replies always attach to the top-level comment (one level of threading).
    const parent = await prisma.trendingComment.findFirst({ where: { id: parentId, videoId }, select: { id: true, parentId: true } });
    if (!parent) throw new TrendingError("That comment no longer exists.");
    rootId = parent.parentId ?? parent.id;
  }

  const [comment] = await prisma.$transaction([
    prisma.trendingComment.create({ data: { videoId, authorId: me.id, parentId: rootId, body: text }, select: { id: true } }),
    prisma.trendingVideo.update({ where: { id: videoId }, data: { commentCount: { increment: 1 } } }),
    ...(rootId ? [prisma.trendingComment.update({ where: { id: rootId }, data: { replyCount: { increment: 1 } } })] : []),
  ]);
  return comment.id;
}

export async function editComment(commentId: string, body: string) {
  const me = await requireMyProfile();
  const text = cleanBody(body);
  const updated = await prisma.trendingComment.updateMany({
    where: { id: commentId, authorId: me.id },
    data: { body: text, editedAt: new Date() },
  });
  if (updated.count === 0) throw new TrendingError("You can only edit your own comments.");
}

/** Deletes a comment (and its replies) — by its author, or by the owner of
 * the video it's on. Admins use the moderation service instead. */
export async function deleteComment(commentId: string) {
  const me = await requireMyProfile();
  const comment = await prisma.trendingComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, parentId: true, replyCount: true, videoId: true, video: { select: { profileId: true } } },
  });
  if (!comment || (comment.authorId !== me.id && comment.video.profileId !== me.id)) {
    throw new TrendingError("You can't delete this comment.");
  }
  await removeCommentCompletely(comment);
}

export async function removeCommentCompletely(comment: { id: string; parentId: string | null; replyCount: number; videoId: string }) {
  const removedCount = 1 + (comment.parentId ? 0 : comment.replyCount);
  await prisma.$transaction([
    prisma.trendingComment.delete({ where: { id: comment.id } }), // replies cascade
    prisma.trendingVideo.updateMany({
      where: { id: comment.videoId },
      data: { commentCount: { decrement: removedCount } },
    }),
    ...(comment.parentId
      ? [prisma.trendingComment.updateMany({ where: { id: comment.parentId, replyCount: { gt: 0 } }, data: { replyCount: { decrement: 1 } } })]
      : []),
  ]);
  await prisma.trendingVideo.updateMany({ where: { id: comment.videoId, commentCount: { lt: 0 } }, data: { commentCount: 0 } });
}

export async function setCommentLike(commentId: string, like: boolean) {
  const me = await requireMyProfile();
  checkRateLimit(`trending:like:${me.id}`, { max: 120, windowMs: 60_000 });
  const comment = await prisma.trendingComment.findUnique({ where: { id: commentId }, select: { id: true, videoId: true } });
  if (!comment) throw new TrendingError("That comment no longer exists.");
  await requireVisibleVideo(comment.videoId);

  if (like) {
    try {
      await prisma.$transaction([
        prisma.trendingCommentLike.create({ data: { commentId, profileId: me.id } }),
        prisma.trendingComment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } }),
      ]);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  } else {
    const deleted = await prisma.trendingCommentLike.deleteMany({ where: { commentId, profileId: me.id } });
    if (deleted.count > 0) {
      await prisma.trendingComment.updateMany({ where: { id: commentId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
    }
  }
  const row = await prisma.trendingComment.findUnique({ where: { id: commentId }, select: { likeCount: true } });
  return { liked: like, likeCount: row?.likeCount ?? 0 };
}

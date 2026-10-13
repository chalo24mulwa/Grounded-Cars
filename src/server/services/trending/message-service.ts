import "server-only";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/server/services/rate-limit";
import { MESSAGE_MAX } from "@/lib/trending/config";
import { requireMyProfile, getBlockedProfileIds, TrendingError } from "@/server/services/trending/profile-service";

// Private, one-to-one messages. Every function re-checks on the server that
// the signed-in user is one of the two participants; conversation ids from
// the browser are never trusted on their own.

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const PARTICIPANT_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;

/** Finds or creates the conversation between the viewer and another profile. */
export async function openConversationWith(otherProfileId: string): Promise<string> {
  const me = await requireMyProfile();
  if (otherProfileId === me.id) throw new TrendingError("You can't message yourself.");
  const other = await prisma.trendingProfile.findUnique({ where: { id: otherProfileId }, select: { id: true } });
  if (!other) throw new TrendingError("That account no longer exists.");
  const blocked = await getBlockedProfileIds(me.id);
  if (blocked.includes(other.id)) throw new TrendingError("You can't message this account.");

  const [profileAId, profileBId] = orderedPair(me.id, other.id);
  const conversation = await prisma.trendingConversation.upsert({
    where: { profileAId_profileBId: { profileAId, profileBId } },
    create: { profileAId, profileBId },
    update: {},
    select: { id: true },
  });
  return conversation.id;
}

async function requireParticipant(conversationId: string) {
  const me = await requireMyProfile();
  const conversation = await prisma.trendingConversation.findFirst({
    where: { id: conversationId, OR: [{ profileAId: me.id }, { profileBId: me.id }] },
    include: { profileA: { select: PARTICIPANT_SELECT }, profileB: { select: PARTICIPANT_SELECT } },
  });
  if (!conversation) throw new TrendingError("Conversation not found.");
  const other = conversation.profileAId === me.id ? conversation.profileB : conversation.profileA;
  return { me, conversation, other };
}

export async function sendMessage(conversationId: string, body: string, videoRefId?: string | null) {
  const { me, other } = await requireParticipant(conversationId);
  checkRateLimit(`trending:msg:${me.id}`, { max: 30, windowMs: 60_000 });
  checkRateLimit(`trending:msg-hour:${me.id}`, { max: 300, windowMs: 60 * 60_000 });
  const blocked = await getBlockedProfileIds(me.id);
  if (blocked.includes(other.id)) throw new TrendingError("You can't message this account.");
  const text = body.trim();
  if (!text) throw new TrendingError("Write a message first.");
  if (text.length > MESSAGE_MAX) throw new TrendingError(`Messages can be up to ${MESSAGE_MAX} characters.`);

  const now = new Date();
  await prisma.$transaction([
    prisma.trendingMessage.create({
      data: { conversationId, senderId: me.id, body: text, videoRefId: videoRefId || null, createdAt: now },
    }),
    prisma.trendingConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
  ]);
}

export type MessageView = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  readAt: string | null;
  video: { id: string; available: boolean; poster: string | null } | null;
};

/** Messages after `afterId` (or the latest 50), oldest first; marks the
 * other person's messages as read. */
export async function getConversation(conversationId: string, afterCreatedAt?: string | null) {
  const { me, other } = await requireParticipant(conversationId);
  const blocked = (await getBlockedProfileIds(me.id)).includes(other.id);

  const after = afterCreatedAt ? new Date(afterCreatedAt) : null;
  const rows = await prisma.trendingMessage.findMany({
    where: { conversationId, ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: 50,
  });
  if (!after) rows.reverse();

  await prisma.trendingMessage.updateMany({
    where: { conversationId, senderId: other.id, readAt: null },
    data: { readAt: new Date() },
  });

  // Messages keep only a plain reference to the video they were sent from;
  // once it has expired the chat shows "This video is no longer available".
  const videoIds = [...new Set(rows.map((r) => r.videoRefId).filter((v): v is string => Boolean(v)))];
  const videos = videoIds.length
    ? await prisma.trendingVideo.findMany({
        where: { id: { in: videoIds }, status: "READY", expiresAt: { gt: new Date() }, removedByAdmin: false },
        select: { id: true, coverUrl: true, muxPlaybackId: true },
      })
    : [];
  const { thumbnailUrl } = await import("@/lib/trending/config");
  const byId = new Map(videos.map((v) => [v.id, v]));

  const messages: MessageView[] = rows.map((r) => {
    const v = r.videoRefId ? byId.get(r.videoRefId) : undefined;
    return {
      id: r.id,
      body: r.body,
      mine: r.senderId === me.id,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt?.toISOString() ?? null,
      video: r.videoRefId
        ? {
            id: r.videoRefId,
            available: Boolean(v),
            poster: v ? (v.coverUrl ?? (v.muxPlaybackId ? thumbnailUrl(v.muxPlaybackId, 240) : null)) : null,
          }
        : null,
    };
  });
  return { other, blocked, messages };
}

export async function listMyConversations() {
  const me = await requireMyProfile();
  const conversations = await prisma.trendingConversation.findMany({
    where: { OR: [{ profileAId: me.id }, { profileBId: me.id }], messages: { some: {} } },
    include: {
      profileA: { select: PARTICIPANT_SELECT },
      profileB: { select: PARTICIPANT_SELECT },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });
  const unread = await prisma.trendingMessage.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: conversations.map((c) => c.id) }, senderId: { not: me.id }, readAt: null },
    _count: { _all: true },
  });
  const unreadBy = new Map(unread.map((u) => [u.conversationId, u._count._all]));
  return conversations.map((c) => ({
    id: c.id,
    other: c.profileAId === me.id ? c.profileB : c.profileA,
    lastMessage: c.messages[0]
      ? { body: c.messages[0].body, mine: c.messages[0].senderId === me.id, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    unread: unreadBy.get(c.id) ?? 0,
  }));
}

export async function countMyUnreadMessages(): Promise<number> {
  const me = await requireMyProfile();
  return prisma.trendingMessage.count({
    where: {
      readAt: null,
      senderId: { not: me.id },
      conversation: { OR: [{ profileAId: me.id }, { profileBId: me.id }] },
    },
  });
}

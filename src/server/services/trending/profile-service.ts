import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAuth, AuthorizationError } from "@/server/authorization/ownership";
import { isTrendingEnabled, BIO_MAX, USERNAME_PATTERN } from "@/lib/trending/config";
import { saveTrendingImage, deleteTrendingImage } from "@/lib/storage";
import { checkRateLimit } from "@/server/services/rate-limit";

/** A problem the user can fix; its message is safe to show as-is. */
export class TrendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrendingError";
  }
}

export function assertTrendingEnabled(): void {
  if (!isTrendingEnabled()) throw new TrendingError("Trending is not available yet.");
}

const PROFILE_SELECT = {
  id: true,
  userId: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  postingSuspended: true,
} satisfies Prisma.TrendingProfileSelect;

export type TrendingProfileSummary = Prisma.TrendingProfileGetPayload<{ select: typeof PROFILE_SELECT }>;

function usernameBase(name: string | null | undefined): string {
  const base = (name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
  return base.length >= 3 ? base : "driver";
}

/**
 * Every account automatically has a Trending profile: existing users got one
 * from the migration's backfill, and anyone newer gets one the first time
 * they touch Trending — no separate sign-up, nothing for the user to do. The
 * account's own sign-up flow is deliberately left untouched.
 */
async function getOrCreateProfileForUser(userId: string): Promise<TrendingProfileSummary> {
  const existing = await prisma.trendingProfile.findUnique({ where: { userId }, select: PROFILE_SELECT });
  if (existing) return existing;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) throw new AuthorizationError();
  const base = usernameBase(user.name);

  for (let attempt = 0; attempt < 5; attempt++) {
    const username = `${base}_${crypto.randomBytes(3).toString("hex")}`;
    try {
      return await prisma.trendingProfile.create({
        data: { userId, username, displayName: user.name?.trim() || "Car Marketplace user" },
        select: PROFILE_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Either the username clashed (retry with another) or a parallel
        // request just created this user's profile (return that one).
        const raced = await prisma.trendingProfile.findUnique({ where: { userId }, select: PROFILE_SELECT });
        if (raced) return raced;
        continue;
      }
      throw error;
    }
  }
  throw new TrendingError("Could not set up your Trending profile. Please try again.");
}

/** The signed-in user's Trending profile (created if needed). Throws if not
 * signed in or suspended — use for anything that changes data. */
export async function requireMyProfile(): Promise<TrendingProfileSummary> {
  assertTrendingEnabled();
  const user = await requireAuth();
  return getOrCreateProfileForUser(user.id);
}

/** The viewer's profile if signed in, otherwise null. For read-only pages. */
export const getViewerProfile = cache(async (): Promise<TrendingProfileSummary | null> => {
  if (!isTrendingEnabled()) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  try {
    return await getOrCreateProfileForUser(session.user.id);
  } catch {
    return null;
  }
});

export async function getProfileByUsername(username: string) {
  return prisma.trendingProfile.findUnique({
    where: { username: username.toLowerCase() },
    select: { ...PROFILE_SELECT, createdAt: true },
  });
}

export async function updateMyProfile(input: { username: string; displayName: string; bio: string }) {
  const me = await requireMyProfile();
  checkRateLimit(`trending:profile:${me.id}`, { max: 20, windowMs: 60 * 60_000 });

  const username = input.username.trim().toLowerCase().replace(/^@/, "");
  const displayName = input.displayName.trim().replace(/\s+/g, " ");
  const bio = input.bio.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new TrendingError("Usernames are 3-24 characters: lowercase letters, numbers, dots and underscores.");
  }
  if (displayName.length < 2 || displayName.length > 50) throw new TrendingError("Name must be 2-50 characters.");
  if (bio.length > BIO_MAX) throw new TrendingError(`Bio must be ${BIO_MAX} characters or fewer.`);

  try {
    return await prisma.trendingProfile.update({
      where: { id: me.id },
      data: { username, displayName, bio: bio || null },
      select: PROFILE_SELECT,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TrendingError("That username is taken. Please choose another.");
    }
    throw error;
  }
}

/** Sets or replaces the profile picture; the previous file is deleted. */
export async function setMyAvatar(file: File) {
  const me = await requireMyProfile();
  checkRateLimit(`trending:avatar:${me.id}`, { max: 10, windowMs: 60 * 60_000 });
  const saved = await saveTrendingImage("avatars", file);
  const previous = await prisma.trendingProfile.findUnique({ where: { id: me.id }, select: { avatarKey: true } });
  await prisma.trendingProfile.update({
    where: { id: me.id },
    data: { avatarUrl: saved.imageUrl, avatarKey: saved.storageKey },
  });
  await deleteTrendingImage(previous?.avatarKey);
  return saved.imageUrl;
}

export async function removeMyAvatar() {
  const me = await requireMyProfile();
  const previous = await prisma.trendingProfile.findUnique({ where: { id: me.id }, select: { avatarKey: true } });
  await prisma.trendingProfile.update({ where: { id: me.id }, data: { avatarUrl: null, avatarKey: null } });
  await deleteTrendingImage(previous?.avatarKey);
}

/** Profile ids the viewer has blocked or been blocked by — their content and
 * messages are hidden in both directions. */
export async function getBlockedProfileIds(profileId: string | null | undefined): Promise<string[]> {
  if (!profileId) return [];
  const rows = await prisma.trendingBlock.findMany({
    where: { OR: [{ blockerId: profileId }, { blockedId: profileId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((row) => (row.blockerId === profileId ? row.blockedId : row.blockerId));
}

export async function setBlocked(targetProfileId: string, blocked: boolean) {
  const me = await requireMyProfile();
  if (targetProfileId === me.id) throw new TrendingError("You can't block yourself.");
  if (blocked) {
    await prisma.trendingBlock.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: targetProfileId } },
      create: { blockerId: me.id, blockedId: targetProfileId },
      update: {},
    });
  } else {
    await prisma.trendingBlock.deleteMany({ where: { blockerId: me.id, blockedId: targetProfileId } });
  }
}

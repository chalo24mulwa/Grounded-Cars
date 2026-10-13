import "server-only";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAuth } from "@/server/authorization/ownership";

// ----------------------------------------------------------------------------
// Favorites. The Favorite model (with its @@unique([userId, listingId])
// constraint) has existed since Phase 1 — this phase is the service/UI
// layer on top of it. Every function here scopes to the CURRENT session
// user only; there is no "favorites for user X" lookup anywhere, by
// design — that's what "never expose private user data" means in
// practice for this feature (a buyer's saved-cars list is never
// readable by anyone but that buyer, not even via a crafted request).
// ----------------------------------------------------------------------------

/** Idempotent: favoriting an already-favorited listing is a harmless no-op,
 * not an error — relies on the DB unique constraint rather than a
 * check-then-insert race, which is the only way this is actually safe
 * under concurrent double-clicks. */
export async function addFavorite(listingId: string) {
  const user = await requireAuth();

  await prisma.favorite.upsert({
    where: { userId_listingId: { userId: user.id, listingId } },
    update: {},
    create: { userId: user.id, listingId },
  });
  await syncFavoritesCookieSafely(user.id);
}

export async function removeFavorite(listingId: string) {
  const user = await requireAuth();

  await prisma.favorite.deleteMany({
    where: { userId: user.id, listingId },
  });
  await syncFavoritesCookieSafely(user.id);
}

// ----------------------------------------------------------------------------
// Fast heart icons for signed-in visitors.
//
// Every listing page shows filled/outline hearts, and looking those up used
// to cost two database round trips per page view for anyone signed in
// (anonymous pages are served from memory). Against the hosted database that
// was 1-3 seconds per page, and 10+ seconds when the database had gone to
// sleep. Now the visitor's own saved-car ids travel in a small cookie
// (`cm_fav`), with a per-process memory copy as the fallback, so a page view
// needs no database work at all.
//
// The cookie only decides which hearts look filled for that visitor. It is
// tied to the user id (a different account on the same browser ignores it)
// and is rewritten from the database after every save/unsave. Saving and
// unsaving still go through the database with full checks, as before.
// ----------------------------------------------------------------------------

export const FAVORITES_COOKIE = "cm_fav";
/** ~25-character ids: keeps the cookie well under the 4 KB browser limit.
 * Larger lists simply fall back to the memory/database path. */
const MAX_COOKIE_IDS = 120;
const MEMORY_TTL_MS = 10 * 60_000;

const memory = ((globalThis as unknown as { __favIds?: Map<string, { ids: string[]; at: number }> }).__favIds ??=
  new Map());

function encodeCookie(userId: string, ids: string[]): string {
  return `${userId}.${ids.join(".")}`;
}

/** The ids stored in the cookie for this user, or null if the cookie is
 * missing, malformed or belongs to someone else. */
export async function readFavoritesCookie(userId: string): Promise<string[] | null> {
  const raw = (await cookies()).get(FAVORITES_COOKIE)?.value;
  if (!raw) return null;
  const [owner, ...ids] = raw.split(".");
  if (owner !== userId) return null;
  return ids.filter((id) => /^[a-zA-Z0-9_-]{1,40}$/.test(id));
}

async function loadFavoriteIds(userId: string): Promise<string[]> {
  const rows = await prisma.favorite.findMany({ where: { userId }, select: { listingId: true } });
  const ids = rows.map((r) => r.listingId);
  memory.set(userId, { ids, at: Date.now() });
  return ids;
}

/** Rewrites the cookie from the database. Only callable where cookies can be
 * set (server actions and route handlers). */
export async function syncFavoritesCookie(userId: string): Promise<void> {
  const ids = await loadFavoriteIds(userId);
  const jar = await cookies();
  if (ids.length > MAX_COOKIE_IDS) {
    jar.delete(FAVORITES_COOKIE);
    return;
  }
  jar.set(FAVORITES_COOKIE, encodeCookie(userId, ids), {
    httpOnly: true,
    sameSite: "lax",
    // HTTPS-only on the live site; a plain-http test copy can still use it.
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://").startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Never fails a save/unsave that already succeeded: if the cookie can't be
 * refreshed, it's removed so pages fall back to the database. */
async function syncFavoritesCookieSafely(userId: string): Promise<void> {
  try {
    await syncFavoritesCookie(userId);
  } catch (error) {
    memory.delete(userId);
    try {
      (await cookies()).delete(FAVORITES_COOKIE);
    } catch {
      /* not in a context that can change cookies */
    }
    console.error("[favorites] cookie refresh failed:", error);
  }
}

/** The current user's own favorited listing ids only — used to render
 * filled-vs-outline heart icons across a page of cards without an N+1
 * query per card. Cookie first, then memory, then the database. */
export async function getMyFavoriteListingIds(): Promise<Set<string>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Set();

  const fromCookie = await readFavoritesCookie(userId);
  if (fromCookie) return new Set(fromCookie);

  const cached = memory.get(userId);
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) return new Set(cached.ids);

  return new Set(await loadFavoriteIds(userId));
}

/** The current user's saved-cars list, most recently saved first. Includes
 * the listing's current status (ACTIVE/SOLD/etc.) so the UI can show a
 * SOLD badge or an "no longer available" note rather than silently hiding
 * a listing the buyer explicitly chose to track. */
export async function getMyFavorites() {
  const user = await requireAuth();
  return prisma.favorite.findMany({
    where: { userId: user.id },
    include: {
      listing: {
        // Matches listing-service.ts's CARD_IMAGE_PREVIEW_COUNT — CarCard
        // plays through a listing's photos in place now, not just the
        // single primary one, so this needs more than one row too.
        include: { images: { orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }], take: 6 } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Live count for a single listing — e.g. a seller viewing interest in
 * their own car. Not cached/denormalized, same reasoning as viewCount NOT
 * being used here: favorite counts change rarely enough per listing that a
 * live COUNT (backed by the Favorite.listingId index) is cheap and always
 * correct, with no sync-drift risk to reason about. */
export async function getFavoriteCount(listingId: string): Promise<number> {
  return prisma.favorite.count({ where: { listingId } });
}

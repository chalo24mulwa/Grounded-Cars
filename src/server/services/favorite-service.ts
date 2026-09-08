import "server-only";
import { prisma } from "@/lib/prisma";
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
}

export async function removeFavorite(listingId: string) {
  const user = await requireAuth();

  await prisma.favorite.deleteMany({
    where: { userId: user.id, listingId },
  });
}

/** The current user's own favorited listing ids only — used to render
 * filled-vs-outline heart icons across a page of cards without an N+1
 * query per card. */
export async function getMyFavoriteListingIds(): Promise<Set<string>> {
  const user = await requireAuth();
  const rows = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
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

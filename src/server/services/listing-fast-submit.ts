import "server-only";
import crypto from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { prisma, isTransientConnectionError } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import {
  UPLOAD_ROOT,
  MAX_IMAGES_PER_LISTING,
  InvalidImageError,
  saveListingImage,
  deleteListingImage,
} from "@/lib/storage";
import { pregenerateVariants } from "@/lib/upload-variant-files";
import { checkRateLimit } from "@/server/services/rate-limit";
import { requireRole, AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { applyListingStatusChange, defaultListingImageAltText } from "@/server/services/listing-service";
import { createListingSchema, type CreateListingInput } from "@/server/validation/listing-schema";
import type { UserRole } from "@prisma/client";

// ----------------------------------------------------------------------------
// Fast "Add New Car" submission.
//
// Before: clicking Submit uploaded every photo, watermarked each one, then
// made a dozen database round trips (create, history, photos, submit) before
// the seller saw anything — and closing the page mid-way lost the listing.
//
// Now:
// 1. Each photo is uploaded and watermarked as soon as the seller picks it
//    (stagePhoto), straight into the folder the listing will use. The
//    seller gets back a signed token per photo.
// 2. Submit sends only the form text and those tokens — a few KB, sent with
//    `keepalive` so the browser finishes sending it even if the page is
//    closed. quickCreateListing checks everything that can be checked
//    without the database (signed-in role, rate limit, form validation,
//    photo tokens), answers straight away with the new listing's id, and
//    writes the listing in the background (createListingInBackground),
//    retrying through dropped database connections.
//
// The listing that results is identical to the old path: same fields, slug,
// photos (order, cover photo, alt text), "Listing created." history row and,
// for Submit, the same DRAFT → PENDING transition with its own history row,
// via the same applyListingStatusChange() every status change uses.
// ----------------------------------------------------------------------------

const SELLER_ROLES: UserRole[] = ["SELLER", "ADMIN", "MODERATOR"];
const ID_PATTERN = /^c[a-z0-9]{24}$/;
const KEY_PATTERN = /^[a-f0-9]{32}\.jpg$/;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(...parts: string[]): string {
  return crypto.createHmac("sha256", secret()).update(parts.join("|")).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** A new listing id in the same shape as Prisma's cuid() ids. */
function newListingId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(24);
  let id = "c";
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}

export type PendingListing = { pid: string; pidSig: string };

function issuePendingListing(userId: string): PendingListing {
  const pid = newListingId();
  return { pid, pidSig: sign("pid", userId, pid) };
}

function verifyPendingListing(userId: string, pending: PendingListing): boolean {
  return ID_PATTERN.test(pending.pid) && safeEqual(pending.pidSig, sign("pid", userId, pending.pid));
}

function photoToken(userId: string, pid: string, key: string): string {
  return `${pid}.${key}.${sign("photo", userId, pid, key)}`;
}

function readPhotoToken(userId: string, token: string): { pid: string; key: string } | null {
  // "<pid>.<hex>.jpg.<signature>"
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [pid, hex, ext, sig] = parts as [string, string, string, string];
  const key = `${hex}.${ext}`;
  if (!ID_PATTERN.test(pid) || !KEY_PATTERN.test(key)) return null;
  return safeEqual(sig, sign("photo", userId, pid, key)) ? { pid, key } : null;
}

async function listingExists(id: string): Promise<boolean> {
  return (await prisma.carListing.count({ where: { id } })) > 0;
}

/** Step 1: one photo, uploaded the moment it's picked. */
export async function stagePhoto(file: File, pending: PendingListing | null) {
  const user = await requireRole(...SELLER_ROLES);
  checkRateLimit(`image-upload:${user.id}`, { max: 40, windowMs: 60 * 60 * 1000 });

  const reservation = pending && verifyPendingListing(user.id, pending) ? pending : issuePendingListing(user.id);
  const saved = await saveListingImage(reservation.pid, file);
  void pregenerateVariants(saved.imageUrl);

  const key = saved.storageKey.slice(reservation.pid.length + 1);
  return { ...reservation, token: photoToken(user.id, reservation.pid, key), url: saved.imageUrl };
}

/** A staged photo the seller removed again before submitting. */
export async function unstagePhoto(token: string) {
  const user = await requireRole(...SELLER_ROLES);
  const photo = readPhotoToken(user.id, token);
  if (!photo) throw new AuthorizationError("Invalid photo.");
  // Once the listing exists its photos are managed on the edit page only.
  if (await listingExists(photo.pid)) return;
  await deleteListingImage(`${photo.pid}/${photo.key}`);
}

// Jobs still running in this process, so a page that needs the new listing
// (the "submitted" page, the draft's edit page) can wait for it directly.
type JobResult = { ok: true } | { ok: false; error: unknown };
const running = ((globalThis as unknown as { __fastListingJobs?: Map<string, Promise<JobResult>> }).__fastListingJobs ??=
  new Map());

/** Step 2: Submit / Save as Draft. Returns as soon as the request is known
 * to be valid; the database work continues in the background. */
export async function quickCreateListing(body: {
  input: CreateListingInput;
  intent: "submit" | "draft";
  pending: PendingListing | null;
  photoTokens: string[];
}): Promise<{ id: string }> {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.id) throw new AuthenticationError();
  if (!SELLER_ROLES.includes(sessionUser.role)) {
    throw new AuthorizationError("This action requires a seller account.");
  }

  checkRateLimit(`listing-create:${sessionUser.id}`, { max: 20, windowMs: 60 * 60 * 1000 });
  const data = createListingSchema.parse(body.input);

  const pending =
    body.pending && verifyPendingListing(sessionUser.id, body.pending) ? body.pending : issuePendingListing(sessionUser.id);
  if (body.photoTokens.length > MAX_IMAGES_PER_LISTING) {
    throw new InvalidImageError(`A listing can have at most ${MAX_IMAGES_PER_LISTING} photos.`);
  }
  const photos: { storageKey: string; imageUrl: string }[] = [];
  for (const token of body.photoTokens) {
    const photo = readPhotoToken(sessionUser.id, token);
    if (!photo || photo.pid !== pending.pid) throw new InvalidImageError("A photo could not be found. Please add it again.");
    const storageKey = `${photo.pid}/${photo.key}`;
    try {
      await access(path.join(UPLOAD_ROOT, "listings", storageKey));
    } catch {
      throw new InvalidImageError("A photo could not be found. Please add it again.");
    }
    photos.push({ storageKey, imageUrl: `/uploads/listings/${storageKey}` });
  }

  const user = { id: sessionUser.id, role: sessionUser.role };
  const id = pending.pid;
  const settled = createListingInBackground({ user, id, data, intent: body.intent, photos }).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error })
  );
  running.set(id, settled);
  void settled.finally(() => running.delete(id));
  // A failure that happens immediately (rather than a slow database) is
  // still reported to the seller instead of being lost.
  const early = await Promise.race([settled, new Promise<null>((r) => setTimeout(() => r(null), 250))]);
  if (early && !early.ok) throw early.error;
  return { id };
}

async function createListingInBackground(args: {
  user: { id: string; role: UserRole };
  id: string;
  data: CreateListingInput;
  intent: "submit" | "draft";
  photos: { storageKey: string; imageUrl: string }[];
}) {
  const { user, id, data, intent, photos } = args;
  const baseSlug = slugify(`${data.year}-${data.make}-${data.model}-${data.title}`);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
  const altText = defaultListingImageAltText({
    year: data.year,
    make: data.make,
    model: data.model,
    location: data.location ?? null,
  });

  for (let attempt = 1; ; attempt++) {
    try {
      // Same live account check requireRole() makes: a suspended account
      // can't create listings.
      const account = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } });
      if (!account || account.status !== "ACTIVE") {
        console.error(`[fast-submit] listing ${id} not created: account ${user.id} is not active`);
        return;
      }

      let listing = await prisma.carListing.findUnique({ where: { id } });
      if (!listing) {
        listing = await prisma.carListing.create({
          data: {
            ...data,
            id,
            slug,
            sellerId: user.id,
            status: "DRAFT",
            images: {
              createMany: {
                data: photos.map((photo, i) => ({
                  imageUrl: photo.imageUrl,
                  storageKey: photo.storageKey,
                  displayOrder: i,
                  isPrimary: i === 0,
                  altText,
                })),
              },
            },
            statusHistory: {
              create: { fromStatus: null, toStatus: "DRAFT", changedById: user.id, note: "Listing created." },
            },
          },
        });
      }

      if (intent === "submit" && listing.status === "DRAFT") {
        await applyListingStatusChange(user, listing, "PENDING", "Submitted for review.");
      }
      return;
    } catch (error) {
      if (attempt < 6 && isRetryable(error)) {
        await new Promise((r) => setTimeout(r, Math.min(15_000, 500 * 2 ** attempt)));
        continue;
      }
      console.error(`[fast-submit] listing ${id} could not be saved:`, error);
      throw error;
    }
  }
}

function isRetryable(error: unknown): boolean {
  if (isTransientConnectionError(error)) return true;
  const code = (error as { code?: string } | null)?.code;
  // Can't reach / timed out / connection pool timeout / transaction errors.
  return code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017" || code === "P2024" || code === "P2028";
}

/** For pages opened right after a fast submission: waits (briefly) until
 * the background save has created the listing. */
export async function waitForNewListing(id: string, maxMs = 20_000): Promise<void> {
  const job = running.get(id);
  if (job) {
    await Promise.race([job, new Promise((r) => setTimeout(r, maxMs))]);
    return;
  }
  // Another server process may be running it: check the database instead.
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await listingExists(id)) return;
    await new Promise((r) => setTimeout(r, 400));
  }
}

/**
 * Photos uploaded for a listing that was never submitted (the seller picked
 * photos, then left without saving) sit in a folder with no listing behind
 * it. Removes such folders once they're two days old. A folder is only
 * removed when the database positively confirms no listing has its id.
 */
export async function cleanupAbandonedPhotoUploads(): Promise<number> {
  const { readdir, stat, rm } = await import("node:fs/promises");
  const root = path.join(UPLOAD_ROOT, "listings");
  let names: string[];
  try {
    names = await readdir(root);
  } catch {
    return 0;
  }
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const candidates: string[] = [];
  for (const name of names) {
    if (!ID_PATTERN.test(name)) continue;
    try {
      const info = await stat(path.join(root, name));
      if (info.isDirectory() && info.mtimeMs < cutoff) candidates.push(name);
    } catch {
      /* vanished meanwhile */
    }
  }
  let removed = 0;
  for (let i = 0; i < candidates.length; i += 500) {
    const chunk = candidates.slice(i, i + 500);
    const existing = await prisma.carListing.findMany({ where: { id: { in: chunk } }, select: { id: true } });
    const keep = new Set(existing.map((l) => l.id));
    for (const name of chunk) {
      if (keep.has(name)) continue;
      await rm(path.join(root, name), { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}

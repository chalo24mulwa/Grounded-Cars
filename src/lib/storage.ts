import "server-only";
import crypto from "node:crypto";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// ----------------------------------------------------------------------------
// Local-disk image storage for Phase 3. Deliberately isolated behind this
// one module — swapping to an S3-compatible provider (Cloudflare R2 /
// Backblaze B2, per docs/architecture.md's open question) later means
// rewriting saveListingImage/deleteListingImage here only; nothing that
// calls them (listing-service.ts) needs to change, since callers only ever
// see a public URL string back, never a filesystem path.
//
// This works today because the documented target host (Namecheap Stellar
// Plus, via its Node.js app support) has a persistent filesystem — it would
// NOT work on ephemeral/serverless hosting, which is exactly why this stays
// swappable rather than assumed permanent. STORAGE_PROVIDER in .env.example
// already reserves the env vars this will need once that migration happens.
// ----------------------------------------------------------------------------

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const UPLOAD_DIR = path.join(UPLOAD_ROOT, "listings");
const PUBLIC_BASE_PATH = "/uploads/listings";

const EVENTS_UPLOAD_DIR = path.join(UPLOAD_ROOT, "events");
const EVENTS_PUBLIC_BASE_PATH = "/uploads/events";

const CSR_UPLOAD_DIR = path.join(UPLOAD_ROOT, "csr");
const CSR_PUBLIC_BASE_PATH = "/uploads/csr";

const SERVICES_UPLOAD_DIR = path.join(UPLOAD_ROOT, "services");
const SERVICES_PUBLIC_BASE_PATH = "/uploads/services";

const INSURANCE_UPLOAD_DIR = path.join(UPLOAD_ROOT, "insurance");
const INSURANCE_PUBLIC_BASE_PATH = "/uploads/insurance";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
// Enough for a thorough listing (multiple angles, interior, engine bay)
// without letting one listing consume unbounded disk space — the byte-size
// cap above bounds each file, this bounds how many of them one listing can
// have. Checked server-side in listing-service.ts's addListingImage, not
// just hinted at in the UI.
export const MAX_IMAGES_PER_LISTING = 10;
// Cover photo + gallery — generous enough for a real initiative story
// without unbounded disk growth, same rationale as MAX_IMAGES_PER_LISTING.
export const MAX_IMAGES_PER_CSR_INITIATIVE = 15;
// A service listing's own product-style gallery — same rationale as the
// other per-entity caps above.
export const MAX_IMAGES_PER_SERVICE = 10;

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

function extensionForType(type: string): string {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      throw new InvalidImageError("Unsupported image type.");
  }
}

// A browser-supplied `file.type` is just the client's own claim (or, for a
// hand-crafted upload bypassing the browser entirely, whatever an attacker
// chose to send) — it's never proof of what the bytes actually are. This
// checks each allowed format's real magic-number signature so a
// mislabeled/disguised file is rejected before it's ever written to disk,
// on top of (not instead of) the declared-type check above.
const MAGIC_BYTES: Record<(typeof ALLOWED_IMAGE_TYPES)[number], (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  // WebP: "RIFF" .... "WEBP" — bytes 0-3 and 8-11.
  "image/webp": (b) =>
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
};

// Shared by every image-accepting upload (listings, events, ...) — one
// place decides "is this actually a valid image," so a future upload
// surface never has to remember to re-implement the magic-byte check.
async function validateImageFile(file: File): Promise<Uint8Array> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new InvalidImageError("Only JPEG, PNG, or WebP images are allowed.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new InvalidImageError("Images must be 5MB or smaller.");
  }
  if (file.size === 0) {
    throw new InvalidImageError("The selected file is empty.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = file.type as (typeof ALLOWED_IMAGE_TYPES)[number];
  if (!MAGIC_BYTES[type](bytes)) {
    throw new InvalidImageError(
      "This file doesn't look like a valid image. Please upload a real JPEG, PNG, or WebP file."
    );
  }
  return bytes;
}

// Every image on the site (listing photos, event photos) gets this baked
// into the actual pixels at upload time — not a CSS overlay, so it's still
// there in the saved file itself if someone right-clicks "Save image" or
// downloads it directly. Applied once, here, so no upload path can forget
// it later.
const WATERMARK_TEXT = "carmarketplace.co.ke";

async function applyWatermark(
  bytes: Uint8Array,
  mimeType: (typeof ALLOWED_IMAGE_TYPES)[number]
): Promise<Buffer> {
  // Bake in EXIF orientation and re-measure post-rotation — compositing
  // against the raw (pre-rotation) width/height would place the watermark
  // off-center on any photo shot in portrait on a phone.
  const { data, info } = await sharp(Buffer.from(bytes))
    .rotate()
    .toBuffer({ resolveWithObject: true });

  const fontSize = Math.max(18, Math.round(info.width * 0.045));
  const strokeWidth = Math.max(1, Math.round(fontSize * 0.06));
  const svg = `<svg width="${info.width}" height="${info.height}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
      letter-spacing="2" fill="#ffffff" fill-opacity="0.55"
      stroke="#000000" stroke-opacity="0.35" stroke-width="${strokeWidth}">${WATERMARK_TEXT}</text>
  </svg>`;

  const watermarked = sharp(data).composite([{ input: Buffer.from(svg), gravity: "center" }]);

  switch (mimeType) {
    case "image/jpeg":
      return watermarked.jpeg({ quality: 88 }).toBuffer();
    case "image/png":
      return watermarked.png().toBuffer();
    case "image/webp":
      return watermarked.webp({ quality: 88 }).toBuffer();
  }
}

export async function saveListingImage(
  listingId: string,
  file: File
): Promise<{ imageUrl: string; storageKey: string }> {
  const bytes = await validateImageFile(file);
  const watermarked = await applyWatermark(bytes, file.type as (typeof ALLOWED_IMAGE_TYPES)[number]);

  const dir = path.join(UPLOAD_DIR, listingId);
  await mkdir(dir, { recursive: true });

  // Filename is never derived from user input (avoids path traversal and
  // collisions) — a random key is the only identity a stored file has.
  const key = `${crypto.randomBytes(16).toString("hex")}.${extensionForType(file.type)}`;
  await writeFile(path.join(dir, key), watermarked);

  const storageKey = `${listingId}/${key}`;
  return { imageUrl: `${PUBLIC_BASE_PATH}/${storageKey}`, storageKey };
}

export async function deleteListingImage(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_DIR, storageKey));
  } catch (error) {
    // Not fatal — the DB row is the source of truth for what's attached to
    // a listing; a missing file on disk shouldn't block removing the
    // record (e.g. if a previous retry already deleted it).
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to delete listing image file ${storageKey}:`, error);
    }
  }
}

// Event flyers/photos — same validation, own directory, no per-event
// sub-folder (an event has exactly one image, unlike a listing's gallery),
// so the random key alone is the file's identity.
export async function saveEventImage(file: File): Promise<{ imageUrl: string; storageKey: string }> {
  const bytes = await validateImageFile(file);
  const watermarked = await applyWatermark(bytes, file.type as (typeof ALLOWED_IMAGE_TYPES)[number]);

  await mkdir(EVENTS_UPLOAD_DIR, { recursive: true });

  const key = `${crypto.randomBytes(16).toString("hex")}.${extensionForType(file.type)}`;
  await writeFile(path.join(EVENTS_UPLOAD_DIR, key), watermarked);

  return { imageUrl: `${EVENTS_PUBLIC_BASE_PATH}/${key}`, storageKey: key };
}

export async function deleteEventImage(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(EVENTS_UPLOAD_DIR, storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to delete event image file ${storageKey}:`, error);
    }
  }
}

// CSR initiative photos (cover + gallery) — same per-entity subfolder
// convention as saveListingImage (an initiative can have many images, like
// a listing, unlike an event's single flyer), same validation/watermark
// pipeline as every other image type here.
export async function saveCsrImage(
  initiativeId: string,
  file: File
): Promise<{ imageUrl: string; storageKey: string }> {
  const bytes = await validateImageFile(file);
  const watermarked = await applyWatermark(bytes, file.type as (typeof ALLOWED_IMAGE_TYPES)[number]);

  const dir = path.join(CSR_UPLOAD_DIR, initiativeId);
  await mkdir(dir, { recursive: true });

  const key = `${crypto.randomBytes(16).toString("hex")}.${extensionForType(file.type)}`;
  await writeFile(path.join(dir, key), watermarked);

  const storageKey = `${initiativeId}/${key}`;
  return { imageUrl: `${CSR_PUBLIC_BASE_PATH}/${storageKey}`, storageKey };
}

export async function deleteCsrImage(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(CSR_UPLOAD_DIR, storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to delete CSR image file ${storageKey}:`, error);
    }
  }
}

// Orderable-service catalog photos — same per-entity subfolder convention
// as saveListingImage/saveCsrImage (a service can have multiple gallery
// photos, unlike an event's single flyer).
export async function saveServiceImage(
  serviceId: string,
  file: File
): Promise<{ imageUrl: string; storageKey: string }> {
  const bytes = await validateImageFile(file);
  const watermarked = await applyWatermark(bytes, file.type as (typeof ALLOWED_IMAGE_TYPES)[number]);

  const dir = path.join(SERVICES_UPLOAD_DIR, serviceId);
  await mkdir(dir, { recursive: true });

  const key = `${crypto.randomBytes(16).toString("hex")}.${extensionForType(file.type)}`;
  await writeFile(path.join(dir, key), watermarked);

  const storageKey = `${serviceId}/${key}`;
  return { imageUrl: `${SERVICES_PUBLIC_BASE_PATH}/${storageKey}`, storageKey };
}

export async function deleteServiceImage(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(SERVICES_UPLOAD_DIR, storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to delete service image file ${storageKey}:`, error);
    }
  }
}

// Insurance policy cover photos — one image per policy, same flat-directory
// convention as saveEventImage (no per-entity subfolder needed, since
// there's never more than one file to disambiguate).
export async function saveInsurancePolicyImage(file: File): Promise<{ imageUrl: string; storageKey: string }> {
  const bytes = await validateImageFile(file);
  const watermarked = await applyWatermark(bytes, file.type as (typeof ALLOWED_IMAGE_TYPES)[number]);

  await mkdir(INSURANCE_UPLOAD_DIR, { recursive: true });

  const key = `${crypto.randomBytes(16).toString("hex")}.${extensionForType(file.type)}`;
  await writeFile(path.join(INSURANCE_UPLOAD_DIR, key), watermarked);

  return { imageUrl: `${INSURANCE_PUBLIC_BASE_PATH}/${key}`, storageKey: key };
}

export async function deleteInsurancePolicyImage(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(INSURANCE_UPLOAD_DIR, storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to delete insurance policy image file ${storageKey}:`, error);
    }
  }
}

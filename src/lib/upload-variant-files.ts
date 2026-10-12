import "server-only";
import { readFile, stat, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { UPLOAD_ROOT } from "@/lib/storage";
import { VARIANT_WIDTHS, UPLOAD_URL_PREFIX } from "@/lib/upload-variants";

// Produces and caches the resized copies of uploaded photos served at
// /uploads/_v/<width>/... (see lib/upload-variants.ts for the URL scheme).
// Shared by the route that serves them and by the code that makes the common
// sizes ahead of time (right after an upload, and for existing photos at
// server start), so a visitor almost never waits for a resize.

export type VariantFormat = "webp" | "jpeg";

export const VARIANT_CACHE_DIR = path.join(UPLOAD_ROOT, ".variants");
const ALLOWED_WIDTHS = new Set<number>(VARIANT_WIDTHS);
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Quality tuned for photos viewed on phones: visually indistinguishable from
// the stored JPEG at card/gallery sizes, at a fraction of the bytes.
const WEBP_QUALITY = 72;
const JPEG_QUALITY = 75;
// Bounds the work a single (possibly hostile) original can cost — stored
// uploads are already ≤1920px, so this only ever rejects something unexpected.
const MAX_INPUT_PIXELS = 40_000_000;

// Shared hosting has very little CPU: never resize more than this many photos
// at once. Variants requested while all slots are busy wait their turn;
// background pre-generation uses a lower priority (it queues behind visitors).
const MAX_CONCURRENT_RESIZES = 2;
let activeResizes = 0;
const urgentQueue: (() => void)[] = [];
const backgroundQueue: (() => void)[] = [];
async function withResizeSlot<T>(background: boolean, run: () => Promise<T>): Promise<T> {
  if (activeResizes >= MAX_CONCURRENT_RESIZES) {
    await new Promise<void>((resolve) => (background ? backgroundQueue : urgentQueue).push(resolve));
  }
  activeResizes++;
  try {
    return await run();
  } finally {
    activeResizes--;
    (urgentQueue.shift() ?? backgroundQueue.shift())?.();
  }
}
// Two requests for the same not-yet-made variant share one resize.
const inFlight = new Map<string, Promise<Buffer>>();

export function contentTypeFor(filePath: string): string | undefined {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()];
}

/** Resolves URL segments below /uploads to a file inside UPLOAD_ROOT, or null
 * if they try to escape it or aren't an allowed image type. */
export function resolveOriginal(segments: string[]): string | null {
  // Every segment is attacker-controlled input from the URL — reject any
  // path-traversal attempt outright rather than trusting Next's routing to
  // have already sanitized it.
  if (segments.length === 0 || segments.some((s) => s.includes("..") || s.includes("\\") || s.startsWith("."))) {
    return null;
  }
  const filePath = path.join(UPLOAD_ROOT, ...segments);
  // Belt-and-suspenders: the resolved path must still land inside
  // UPLOAD_ROOT even after joining.
  if (!filePath.startsWith(path.normalize(UPLOAD_ROOT) + path.sep)) return null;
  if (!contentTypeFor(filePath)) return null;
  return filePath;
}

async function makeVariant(
  original: string,
  cached: string,
  width: number,
  format: VariantFormat,
  background: boolean
): Promise<Buffer> {
  const data = await withResizeSlot(background, () => {
    const pipeline = sharp(original, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width, withoutEnlargement: true });
    return format === "webp"
      ? pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer()
      : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  });
  // Written to a temp name then renamed, so a concurrent reader never sees a
  // half-written file. Failure to cache is not fatal.
  try {
    await mkdir(path.dirname(cached), { recursive: true });
    const tmp = `${cached}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, cached);
  } catch (error) {
    console.error("Failed to cache image variant:", error);
  }
  return data;
}

/**
 * Returns the bytes of `segments` (path below /uploads) resized to `width`,
 * from the disk cache when present, making it otherwise. Null when the width
 * isn't allowed, the path is invalid, or the original no longer exists — a
 * photo the seller has deleted must stop being served even though a cached
 * copy may still be on disk.
 */
export async function getVariant(
  segments: string[],
  width: number,
  format: VariantFormat,
  { background = false }: { background?: boolean } = {}
): Promise<Buffer | null> {
  if (!ALLOWED_WIDTHS.has(width)) return null;
  const original = resolveOriginal(segments);
  if (!original) return null;

  const originalStat = await stat(original).catch(() => null);
  if (!originalStat?.isFile()) return null;

  const cached = path.join(VARIANT_CACHE_DIR, String(width), ...segments) + `.${format}`;
  const cachedStat = await stat(cached).catch(() => null);
  // A cached copy older than its original means the original was replaced
  // under the same name (never done today — names are random — but cheap).
  if (cachedStat && cachedStat.mtimeMs >= originalStat.mtimeMs) {
    const data = await readFile(cached).catch(() => null);
    if (data) return data;
  }

  let pending = inFlight.get(cached);
  if (!pending) {
    pending = makeVariant(original, cached, width, format, background).finally(() => inFlight.delete(cached));
    inFlight.set(cached, pending);
  }
  return pending;
}

// The sizes visitors actually request: card covers and thumbnails on phones
// and desktops (see the `maxWidth`/`sizes` used with UploadedImage). Larger
// gallery/lightbox sizes are still made on demand.
const PREGENERATED_WIDTHS = [256, 384, 640] as const;

/**
 * Makes the common WebP sizes of an uploaded photo ahead of time, in the
 * background, so the first visitor to see it doesn't wait for the resize.
 * Never throws.
 */
export async function pregenerateVariants(imageUrl: string): Promise<void> {
  if (!imageUrl.startsWith(UPLOAD_URL_PREFIX)) return;
  const segments = imageUrl.slice(UPLOAD_URL_PREFIX.length).split("/");
  for (const width of PREGENERATED_WIDTHS) {
    try {
      await getVariant(segments, width, "webp", { background: true });
    } catch (error) {
      console.error("Failed to pre-generate image variant:", error);
      return;
    }
  }
}

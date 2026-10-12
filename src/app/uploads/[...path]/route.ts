import { NextRequest, NextResponse } from "next/server";
import { readFile, stat, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { UPLOAD_ROOT } from "@/lib/storage";
import { VARIANT_WIDTHS } from "@/lib/upload-variants";

// Serves every uploaded image (listings/events/csr/services/insurance) at
// the exact same /uploads/... public URL every existing imageUrl in the
// database already uses — this route lives at src/app/uploads/ (not
// src/app/api/uploads/) specifically so that URL shape needs no change.
//
// Why this exists instead of just relying on Next's public/ static-file
// serving (which is how this worked originally): on Hostinger, UPLOAD_ROOT
// is set (see storage.ts) to a persistent directory OUTSIDE the versioned
// release tree, so these files are no longer physically inside this app's
// own public/ folder and Next's static convention can no longer reach
// them. When UPLOAD_STORAGE_DIR isn't set (local dev), UPLOAD_ROOT is still
// public/uploads and this route and the static file would both technically
// resolve the same content — Next checks public/ first, so this route only
// actually runs in that case if the static lookup somehow misses.
//
// It also serves resized variants at /uploads/_v/<width>/<path> (see
// lib/upload-variants.ts): made from the original on first request with
// sharp, saved under UPLOAD_ROOT/.variants, and streamed from disk after that.
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const IMMUTABLE = "public, max-age=31536000, immutable";
const VARIANT_SEGMENT = "_v";
const VARIANT_CACHE_DIR = path.join(UPLOAD_ROOT, ".variants");
const ALLOWED_WIDTHS = new Set<number>(VARIANT_WIDTHS);
// Quality tuned for photos viewed on phones: visually indistinguishable from
// the stored JPEG at card/gallery sizes, at a fraction of the bytes.
const WEBP_QUALITY = 72;
const JPEG_QUALITY = 75;
// Bounds the work a single (possibly hostile) original can cost — stored
// uploads are already ≤1920px, so this only ever rejects something unexpected.
const MAX_INPUT_PIXELS = 40_000_000;

// Shared hosting has very little CPU: never resize more than this many photos
// at once (a cold listing grid asks for ~10-20 at the same moment). Variants
// requested while all slots are busy just wait their turn.
const MAX_CONCURRENT_RESIZES = 2;
let activeResizes = 0;
const resizeQueue: (() => void)[] = [];
async function withResizeSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeResizes >= MAX_CONCURRENT_RESIZES) {
    await new Promise<void>((resolve) => resizeQueue.push(resolve));
  }
  activeResizes++;
  try {
    return await run();
  } finally {
    activeResizes--;
    resizeQueue.shift()?.();
  }
}
// Two visitors asking for the same not-yet-made variant share one resize.
const inFlight = new Map<string, Promise<Buffer>>();

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

/** Resolves URL segments below /uploads to a file inside UPLOAD_ROOT, or null
 * if they try to escape it or aren't an allowed image type. */
function resolveOriginal(segments: string[]): string | null {
  // Every segment is attacker-controlled input from the URL — reject any
  // path-traversal attempt outright rather than trusting Next's routing to
  // have already sanitized it.
  if (segments.length === 0 || segments.some((s) => s.includes("..") || s.includes("\\") || s.startsWith("."))) {
    return null;
  }
  const filePath = path.join(UPLOAD_ROOT, ...segments);
  // Belt-and-suspenders: the resolved path must still land inside
  // UPLOAD_ROOT even after joining — catches any traversal the check above
  // didn't anticipate.
  if (!filePath.startsWith(path.normalize(UPLOAD_ROOT) + path.sep)) return null;
  if (!CONTENT_TYPES[path.extname(filePath).toLowerCase()]) return null;
  return filePath;
}

async function makeVariant(original: string, cached: string, width: number, format: "webp" | "jpeg") {
  const data = await withResizeSlot(() => {
    const pipeline = sharp(original, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width, withoutEnlargement: true });
    return format === "webp"
      ? pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer()
      : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  });
  // Written to a temp name then renamed, so a concurrent reader never sees a
  // half-written file. Failure to cache is not fatal — the bytes are served
  // anyway and the next request just makes them again.
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

async function serveVariant(request: NextRequest, widthSegment: string, rest: string[]) {
  const width = Number(widthSegment);
  if (!ALLOWED_WIDTHS.has(width)) return notFound();

  const original = resolveOriginal(rest);
  if (!original) return notFound();

  // The variant only exists while its original does: a photo the seller has
  // since deleted must stop being served, even though its cached copy is
  // still on disk.
  const originalStat = await stat(original).catch(() => null);
  if (!originalStat?.isFile()) {
    return notFound();
  }

  // WebP for every browser that says it accepts it (all current ones), JPEG
  // otherwise. `Vary: Accept` keeps any cache in between from mixing them up.
  const format = (request.headers.get("accept") ?? "").includes("image/webp") ? "webp" : "jpeg";
  const cached = path.join(VARIANT_CACHE_DIR, String(width), ...rest) + `.${format}`;

  let data: Buffer | null = null;
  const cachedStat = await stat(cached).catch(() => null);
  // A cached copy older than its original means the original was replaced
  // under the same name (never done today — names are random — but cheap to
  // guard against).
  if (cachedStat && cachedStat.mtimeMs >= originalStat.mtimeMs) {
    data = await readFile(cached).catch(() => null);
  }
  if (!data) {
    let pending = inFlight.get(cached);
    if (!pending) {
      pending = makeVariant(original, cached, width, format).finally(() => inFlight.delete(cached));
      inFlight.set(cached, pending);
    }
    try {
      data = await pending;
    } catch (error) {
      console.error("Failed to resize uploaded image:", error);
      return notFound();
    }
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": format === "webp" ? "image/webp" : "image/jpeg",
      "Cache-Control": IMMUTABLE,
      Vary: "Accept",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  if (segments[0] === VARIANT_SEGMENT) {
    const [, widthSegment, ...rest] = segments;
    if (!widthSegment) return notFound();
    return serveVariant(request, widthSegment, rest);
  }

  const filePath = resolveOriginal(segments);
  if (!filePath) return notFound();
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()]!;

  try {
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        // Every stored filename is a random, content-immutable key (see
        // storage.ts) — once written it never changes, so this can cache
        // as aggressively as a fingerprinted static asset.
        "Cache-Control": IMMUTABLE,
      },
    });
  } catch {
    return notFound();
  }
}

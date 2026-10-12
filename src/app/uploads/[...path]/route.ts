import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { contentTypeFor, getVariant, resolveOriginal } from "@/lib/upload-variant-files";

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
// lib/upload-variants.ts and lib/upload-variant-files.ts).
const IMMUTABLE = "public, max-age=31536000, immutable";
const VARIANT_SEGMENT = "_v";

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  if (segments[0] === VARIANT_SEGMENT) {
    const [, widthSegment, ...rest] = segments;
    if (!widthSegment) return notFound();
    // WebP for every browser that says it accepts it (all current ones), JPEG
    // otherwise. `Vary: Accept` keeps any cache in between from mixing them up.
    const format = (request.headers.get("accept") ?? "").includes("image/webp") ? "webp" : "jpeg";
    let data: Buffer | null;
    try {
      data = await getVariant(rest, Number(widthSegment), format);
    } catch (error) {
      console.error("Failed to resize uploaded image:", error);
      return notFound();
    }
    if (!data) return notFound();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": format === "webp" ? "image/webp" : "image/jpeg",
        "Cache-Control": IMMUTABLE,
        Vary: "Accept",
      },
    });
  }

  const filePath = resolveOriginal(segments);
  if (!filePath) return notFound();

  try {
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeFor(filePath)!,
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

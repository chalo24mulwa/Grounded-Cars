import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT } from "@/lib/storage";

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
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Every segment is attacker-controlled input from the URL — reject any
  // path-traversal attempt outright rather than trusting Next's routing to
  // have already sanitized it.
  if (segments.some((segment) => segment.includes("..") || segment.includes("\\"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOAD_ROOT, ...segments);
  // Belt-and-suspenders: the resolved path must still land inside
  // UPLOAD_ROOT even after joining — catches any traversal the check above
  // didn't anticipate.
  if (!filePath.startsWith(path.normalize(UPLOAD_ROOT))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        // Every stored filename is a random, content-immutable key (see
        // storage.ts) — once written it never changes, so this can cache
        // as aggressively as a fingerprinted static asset.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

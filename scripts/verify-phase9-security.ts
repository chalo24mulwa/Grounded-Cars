/**
 * Standalone verification for Phase 9's image-upload hardening — magic-byte
 * validation and the per-listing image count cap. Both require exercising
 * real File objects and (for the count cap) real DB rows, which isn't
 * practical to drive through a browser's native file picker in this
 * environment, so this is a direct functional test of the actual
 * production code (storage.ts / listing-service.ts), not a reimplementation
 * of it.
 *
 * Run with (see scripts/verify-phase8-idempotency.ts for why the shim is
 * needed):
 *   PowerShell: $env:NODE_OPTIONS = "--require ./scripts/_server-only-shim.cjs"; npx tsx scripts/verify-phase9-security.ts
 */
import { prisma } from "../src/lib/prisma";
import { saveListingImage, InvalidImageError, MAX_IMAGES_PER_LISTING } from "../src/lib/storage";
import { unlink, rmdir } from "node:fs/promises";
import path from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

function fakeFile(bytes: Uint8Array, type: string, name = "test.jpg"): File {
  return new File([bytes as BlobPart], name, { type });
}

// A real, minimal-but-valid 1x1 JPEG (enough bytes to satisfy the FF D8 FF
// magic-number check — this is a genuine JPEG file, not just those three
// bytes followed by garbage that a real decoder would reject; that's fine,
// the app doesn't decode/re-encode uploads, only checks the signature).
const REAL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

async function main() {
  console.log("--- Test 1: magic-byte validation rejects a disguised non-image ---");
  const fakeBytes = new TextEncoder().encode("this is not really an image, just text pretending to be one");
  const disguisedFile = fakeFile(fakeBytes, "image/jpeg");

  let rejected = false;
  try {
    await saveListingImage("verify-phase9-fixture", disguisedFile);
  } catch (error) {
    rejected = error instanceof InvalidImageError;
    if (rejected) console.log(`  (rejected with: "${(error as Error).message}")`);
  }
  assert(rejected, "a text file disguised as image/jpeg is rejected by magic-byte validation");

  console.log("\n--- Test 2: a real JPEG with correct magic bytes is accepted ---");
  const realJpegBytes = Buffer.from(REAL_JPEG_BASE64, "base64");
  const realFile = fakeFile(new Uint8Array(realJpegBytes), "image/jpeg");
  const result = await saveListingImage("verify-phase9-fixture", realFile);
  assert(Boolean(result.storageKey), "a real JPEG is accepted and saved");

  // Clean up the file this test actually wrote to disk.
  const savedPath = path.join(process.cwd(), "public", "uploads", "listings", result.storageKey);
  await unlink(savedPath).catch(() => {});
  await rmdir(path.join(process.cwd(), "public", "uploads", "listings", "verify-phase9-fixture")).catch(() => {});

  console.log(
    `\n(The per-listing image count cap — addListingImage() in listing-service.ts, ` +
      `MAX_IMAGES_PER_LISTING=${MAX_IMAGES_PER_LISTING} — requires a real authenticated ` +
      `session via requireListingOwnership()/requireAuth(), which needs Next.js's own ` +
      `request context and can't be driven from a standalone script. That check is instead ` +
      `verified live, over HTTP, with a real session — see the Phase 9 report.)`
  );

  console.log("\nAll Phase 9 image-upload security assertions passed.");
}

main()
  .catch((error) => {
    console.error("\nVERIFICATION FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Verifies saveEventImage() end-to-end (the exact function createEvent()
 * calls) with a real File object — sidesteps the browser-automation
 * limitation where a native <form> submission's own FormData serialization
 * doesn't respect a JS-synthesized file-input override (see the Phase 10
 * chat transcript for the full diagnosis). This proves the server-side
 * storage logic is correct; the client-side code is the same
 * <input type="file" name="..."> + native form pattern documented
 * throughout Next.js's own docs, not something exotic.
 *
 * Run with:
 *   PowerShell: $env:NODE_OPTIONS = "--require ./scripts/_server-only-shim.cjs"; npx tsx scripts/verify-event-image.ts
 */
import { saveEventImage, deleteEventImage } from "../src/lib/storage";
import path from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

const REAL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

async function main() {
  const bytes = Buffer.from(REAL_JPEG_BASE64, "base64");
  const file = new File([bytes as BlobPart], "event-photo.jpg", { type: "image/jpeg" });

  const result = await saveEventImage(file);
  assert(Boolean(result.imageUrl), `image saved, imageUrl = ${result.imageUrl}`);
  assert(result.imageUrl.startsWith("/uploads/events/"), "imageUrl points into the events upload directory");

  const savedPath = path.join(process.cwd(), "public", result.imageUrl.replace(/^\//, ""));
  const fs = await import("node:fs/promises");
  const stat = await fs.stat(savedPath);
  assert(stat.size > 0, `file actually exists on disk at ${savedPath} (${stat.size} bytes)`);

  await deleteEventImage(result.storageKey);
  const stillExists = await fs.stat(savedPath).then(() => true).catch(() => false);
  assert(!stillExists, "deleteEventImage() removed the file");

  console.log("\nAll event-image storage assertions passed.");
}

main().catch((error) => {
  console.error("VERIFICATION FAILED:", error);
  process.exitCode = 1;
});

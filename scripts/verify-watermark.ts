/**
 * Verifies the new applyWatermark() step inside saveEventImage()/
 * saveListingImage() actually bakes "carmarketplace.co.ke" into the saved
 * file's pixels (not just a CSS overlay) — generates a plain solid-color
 * JPEG, saves it through the real storage function, then confirms the
 * center pixels differ from the untouched background while a far corner
 * (well outside the centered text) still matches the original color.
 *
 * Run with:
 *   PowerShell: $env:NODE_OPTIONS = "--require ./scripts/_server-only-shim.cjs"; npx tsx scripts/verify-watermark.ts
 */
import sharp from "sharp";
import path from "node:path";
import { saveEventImage, deleteEventImage } from "../src/lib/storage";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function main() {
  const WIDTH = 900;
  const HEIGHT = 600;
  const BG = { r: 40, g: 90, b: 200 }; // a flat mid-blue, nothing near white/black

  const sourceBuffer = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: BG },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const file = new File([sourceBuffer as BlobPart], "watermark-test.jpg", { type: "image/jpeg" });

  const result = await saveEventImage(file);
  assert(Boolean(result.imageUrl), `image saved, imageUrl = ${result.imageUrl}`);

  const savedPath = path.join(process.cwd(), "public", result.imageUrl.replace(/^\//, ""));
  const savedImage = sharp(savedPath);
  const { data, info } = await savedImage.raw().toBuffer({ resolveWithObject: true });

  function pixelAt(x: number, y: number) {
    const idx = (y * info.width + x) * info.channels;
    return { r: data[idx] ?? 0, g: data[idx + 1] ?? 0, b: data[idx + 2] ?? 0 };
  }

  // Average delta-from-background over a region, not a single pixel — a
  // lone sample point could land between glyph strokes and understate how
  // much of the watermark band actually differs from the flat background.
  function avgDelta(cx: number, cy: number, halfSize: number) {
    let total = 0;
    let count = 0;
    for (let y = cy - halfSize; y <= cy + halfSize; y += 4) {
      for (let x = cx - halfSize; x <= cx + halfSize; x += 4) {
        const p = pixelAt(x, y);
        total += Math.abs(p.r - BG.r) + Math.abs(p.g - BG.g) + Math.abs(p.b - BG.b);
        count++;
      }
    }
    return total / count;
  }

  const centerDelta = avgDelta(Math.floor(info.width / 2), Math.floor(info.height / 2), 60);
  const cornerDelta = avgDelta(30, 30, 15);

  console.log(`  center region avg delta from bg: ${centerDelta.toFixed(2)}`);
  console.log(`  corner region avg delta from bg: ${cornerDelta.toFixed(2)}`);

  assert(centerDelta > 15, "center region visibly differs from the flat background (watermark is present)");
  assert(cornerDelta < 10, "corner region is untouched (watermark is centered, not a full-image filter)");

  // Leave a visual copy behind for manual inspection instead of deleting it.
  const outCopy = path.join(process.cwd(), "..", "watermark-preview.jpg");
  await sharp(savedPath).toFile(outCopy);
  console.log(`  Saved a visual copy to ${outCopy}`);

  await deleteEventImage(result.storageKey);

  console.log("\nAll watermark assertions passed.");
}

main().catch((error) => {
  console.error("VERIFICATION FAILED:", error);
  process.exitCode = 1;
});

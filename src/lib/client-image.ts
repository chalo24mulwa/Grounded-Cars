// Browser-only. Shrinks a photo before it is uploaded.
//
// A phone camera photo is routinely 3-8MB, and on a mobile connection the
// upload of that (times several photos) is by far the slowest part of
// submitting a listing. The server re-sizes everything to 1920px anyway (see
// src/lib/storage.ts), so sending the full original only wastes the seller's
// time and data. Doing the same resize here first typically turns a 4MB photo
// into a few hundred KB, which is also what keeps a many-photo listing under
// the request-size limits.
//
// Deliberately fails open: any problem (unsupported browser, corrupt file,
// decode error) returns the original file untouched, and the server remains
// the authoritative validator/resizer either way.

const MAX_DIMENSION_PX = 1920;
const JPEG_QUALITY = 0.85;
// Photos already this small are left exactly as they are — re-encoding them
// would only cost quality for no meaningful saving.
const SKIP_IF_SMALLER_THAN_BYTES = 700 * 1024;
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    // "from-image" applies the EXIF rotation, so a portrait phone photo isn't
    // uploaded sideways once the metadata is dropped by the re-encode.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImageForUpload(file: File): Promise<File> {
  try {
    if (!COMPRESSIBLE_TYPES.has(file.type)) return file;

    const { source, width, height, close } = await decode(file);
    try {
      const longest = Math.max(width, height);
      if (!longest) return file;
      if (longest <= MAX_DIMENSION_PX && file.size <= SKIP_IF_SMALLER_THAN_BYTES) return file;

      const scale = Math.min(1, MAX_DIMENSION_PX / longest);
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      // JPEG has no transparency — paint white first so a transparent PNG
      // doesn't turn black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
      );
      // Only swap it in if it's genuinely smaller.
      if (!blob || blob.size >= file.size) return file;

      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
    } finally {
      close();
    }
  } catch {
    return file;
  }
}

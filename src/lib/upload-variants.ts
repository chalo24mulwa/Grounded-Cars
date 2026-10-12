// Resized copies of uploaded photos ("variants"), shared by the browser-side
// image loader (components/ui/UploadedImage.tsx) and the server route that
// produces them (app/uploads/[...path]/route.ts). No server-only imports here
// — both sides need the same width list.
//
// Why this exists: every uploaded photo is stored once at up to 1920px wide
// (see lib/storage.ts), and Next's built-in image optimizer can't process
// files under /uploads in this hosting environment, so pages used to send
// that full-size original (often 150-480KB) for every card thumbnail. A
// listing grid of 8-24 cards was several megabytes of photos on a phone.
// Variants are made on first request, saved to disk next to the uploads,
// and served with a one-year immutable cache from then on.
//
// URL shape: /uploads/_v/<width>/<original path below /uploads>, e.g.
//   /uploads/listings/abc/123.jpg  ->  /uploads/_v/640/listings/abc/123.jpg
// The "_v" prefix can never collide with a real upload (stored filenames are
// random hex keys inside listings/, events/, csr/, services/, insurance/), and
// unlike a query string it can't be swallowed by public/ static-file serving.

export const UPLOAD_URL_PREFIX = "/uploads/";
export const VARIANT_URL_PREFIX = "/uploads/_v/";

// Every width the loader can ask for — must cover next.config's imageSizes and
// deviceSizes, since next/image builds its srcset from those. Anything larger
// than the stored original is simply served at the original's size.
export const VARIANT_WIDTHS = [96, 128, 256, 384, 640, 828, 1080, 1280, 1920] as const;

export function isUploadUrl(src: string): boolean {
  return src.startsWith(UPLOAD_URL_PREFIX) && !src.startsWith(VARIANT_URL_PREFIX);
}

/** Smallest allowed width that is at least `width` (capped at the largest). */
export function pickVariantWidth(width: number): number {
  for (const w of VARIANT_WIDTHS) if (w >= width) return w;
  return VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]!;
}

/** URL of `src` resized to fit `width`; any non-upload URL (blob: previews,
 * static /images files, external hosts) is returned unchanged. */
export function uploadVariantUrl(src: string, width: number): string {
  if (!isUploadUrl(src)) return src;
  return `${VARIANT_URL_PREFIX}${pickVariantWidth(width)}/${src.slice(UPLOAD_URL_PREFIX.length)}`;
}

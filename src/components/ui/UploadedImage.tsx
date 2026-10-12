"use client";

import Image, { type ImageLoader, type ImageProps } from "next/image";
import { uploadVariantUrl } from "@/lib/upload-variants";

// Drop-in replacement for next/image for seller/admin-uploaded photos
// (anything under /uploads). Instead of shipping the full-size original, the
// browser picks a right-sized WebP/JPEG from a srcset of resized variants —
// see lib/upload-variants.ts and app/uploads/[...path]/route.ts.
//
// A client component because a loader is a function, and functions can't be
// passed from a Server Component to next/image; Server Components can render
// this one as-is. Non-upload sources (e.g. blob: previews) pass through
// untouched.
const uploadLoader: ImageLoader = ({ src, width }) => uploadVariantUrl(src, width);

// One loader per cap, created once — a new function per render would make
// next/image treat every render as a new image.
const cappedLoaders = new Map<number, ImageLoader>();
function loaderFor(maxWidth: number | undefined): ImageLoader {
  if (!maxWidth) return uploadLoader;
  let loader = cappedLoaders.get(maxWidth);
  if (!loader) {
    loader = ({ src, width }) => uploadVariantUrl(src, Math.min(width, maxWidth));
    cappedLoaders.set(maxWidth, loader);
  }
  return loader;
}

type UploadedImageProps = Omit<ImageProps, "loader" | "unoptimized"> & {
  /** Never fetch a copy wider than this many pixels. Phones with 3× screens
   * otherwise ask for 1080px+ photos for a card ~400px wide; capping at 640
   * looks the same at that size and is roughly half the bytes. */
  maxWidth?: number;
};

export function UploadedImage({ maxWidth, ...props }: UploadedImageProps) {
  // alt is required by ImageProps and forwarded via the spread.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} loader={loaderFor(maxWidth)} />;
}

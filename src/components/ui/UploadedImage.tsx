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

export function UploadedImage(props: Omit<ImageProps, "loader" | "unoptimized">) {
  // alt is required by ImageProps and forwarded via the spread.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} loader={uploadLoader} />;
}

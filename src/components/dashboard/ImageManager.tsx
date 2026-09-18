"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { CarImage } from "@prisma/client";
import {
  uploadListingImageAction,
  removeListingImageAction,
  setPrimaryImageAction,
  reorderListingImagesAction,
} from "@/server/actions/listing-actions";
import { compressImageForUpload } from "@/lib/client-image";

// UI-only hints — the server (src/lib/storage.ts) is the authoritative
// validator regardless of what this accepts client-side. Not imported from
// storage.ts directly: that module is "server-only" and can't be pulled
// into a client component.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_MB = 5;

type PendingUpload = {
  key: string;
  previewUrl: string;
  status: "uploading" | "error";
  error?: string;
};

export function ImageManager({ listingId, images }: { listingId: string; images: CarImage[] }) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [isBusy, startTransition] = useTransition();
  const router = useRouter();
  const sorted = [...images].sort((a, b) => a.displayOrder - b.displayOrder);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;

    Array.from(fileList).forEach((original) => {
      const key = `${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(original);
      setPending((prev) => [...prev, { key, previewUrl, status: "uploading" }]);

      // Shrunk in the browser first so the upload is a few hundred KB, not
      // the multi-MB original straight off a phone camera.
      compressImageForUpload(original)
        .then((file) => {
          const formData = new FormData();
          formData.set("file", file);
          return uploadListingImageAction(listingId, {}, formData);
        })
        .then((result) => {
          if (result.success) {
            setPending((prev) => prev.filter((p) => p.key !== key));
            URL.revokeObjectURL(previewUrl);
            router.refresh();
          } else {
            setPending((prev) =>
              prev.map((p) => (p.key === key ? { ...p, status: "error", error: result.error } : p))
            );
          }
        });
    });
  }

  function handleRemove(imageId: string) {
    startTransition(async () => {
      await removeListingImageAction(listingId, imageId);
      router.refresh();
    });
  }

  function handleSetPrimary(imageId: string) {
    startTransition(async () => {
      await setPrimaryImageAction(listingId, imageId);
      router.refresh();
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(target, 0, moved);
    const orderedIds = reordered.map((img) => img.id);

    startTransition(async () => {
      await reorderListingImagesAction(listingId, orderedIds);
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-brand">
        <span className="text-sm font-medium text-slate-700">Click to upload photos</span>
        <span className="mt-1 text-xs text-slate-500">
          JPEG, PNG, or WebP — up to {MAX_MB}MB each. First photo becomes the cover image.
        </span>
        <input
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {(sorted.length > 0 || pending.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sorted.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="relative aspect-square bg-slate-100">
                <Image
                  src={image.imageUrl}
                  alt={image.altText ?? "Car photo"}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="200px"
                />
                {image.isPrimary && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0 || isBusy}
                    onClick={() => handleMove(index, -1)}
                    aria-label="Move earlier"
                    className="rounded px-1.5 py-0.5 text-xs text-slate-600 hover:bg-brand-subtle disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={index === sorted.length - 1 || isBusy}
                    onClick={() => handleMove(index, 1)}
                    aria-label="Move later"
                    className="rounded px-1.5 py-0.5 text-xs text-slate-600 hover:bg-brand-subtle disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
                <div className="flex gap-2">
                  {!image.isPrimary && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSetPrimary(image.id)}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      Set cover
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRemove(image.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {pending.map((p) => (
            <div key={p.key} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="relative aspect-square bg-slate-100">
                <Image
                  src={p.previewUrl}
                  alt="Uploading"
                  fill
                  unoptimized
                  className={clsx("object-cover", p.status === "uploading" && "opacity-60")}
                  sizes="200px"
                />
              </div>
              <div className="p-1.5 text-center text-xs">
                {p.status === "uploading" ? (
                  <span className="text-slate-500">Uploading…</span>
                ) : (
                  <span className="text-red-600">{p.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 && pending.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">
          No photos yet — add at least one so buyers can see the car.
        </p>
      )}
    </div>
  );
}

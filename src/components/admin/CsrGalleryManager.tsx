"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { CsrInitiativeImage } from "@prisma/client";
import { uploadCsrInitiativeImageAction, removeCsrInitiativeImageAction } from "@/server/actions/csr-actions";

// Same upload/preview/remove pattern as dashboard/ImageManager.tsx
// (listings), minus "set primary"/reorder — a CSR initiative's cover photo
// is a separate field on the initiative itself (set via CsrInitiativeForm),
// so this only manages the additional gallery photos.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_MB = 5;

type PendingUpload = {
  key: string;
  previewUrl: string;
  status: "uploading" | "error";
  error?: string;
};

export function CsrGalleryManager({
  initiativeId,
  images,
}: {
  initiativeId: string;
  images: CsrInitiativeImage[];
}) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [isBusy, startTransition] = useTransition();
  const router = useRouter();
  const sorted = [...images].sort((a, b) => a.displayOrder - b.displayOrder);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;

    Array.from(fileList).forEach((file) => {
      const key = `${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);
      setPending((prev) => [...prev, { key, previewUrl, status: "uploading" }]);

      const formData = new FormData();
      formData.set("file", file);

      uploadCsrInitiativeImageAction(initiativeId, {}, formData).then((result) => {
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
      await removeCsrInitiativeImageAction(initiativeId, imageId);
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-brand">
        <span className="text-sm font-medium text-slate-700">Click to upload gallery photos</span>
        <span className="mt-1 text-xs text-slate-500">
          JPEG, PNG, or WebP — up to {MAX_MB}MB each.
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
          {sorted.map((image) => (
            <div key={image.id} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="relative aspect-square bg-slate-100">
                <Image
                  src={image.imageUrl}
                  alt={image.altText ?? "Initiative photo"}
                  fill
                  className="object-cover"
                  sizes="200px"
                />
              </div>
              <div className="flex items-center justify-end p-1.5">
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
        <p className="mt-3 text-sm text-slate-500">No gallery photos yet.</p>
      )}
    </div>
  );
}

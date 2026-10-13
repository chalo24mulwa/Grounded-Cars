"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUploadAction, videoStatusAction } from "@/server/actions/trending-actions";
import { ACCEPTED_VIDEO_TYPES, CAPTION_MAX, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from "@/lib/trending/config";

type ListingOption = { id: string; label: string; make: string; model: string; year: number; price: number; location: string | null };
type Phase = "idle" | "preparing" | "uploading" | "processing" | "done" | "error";

const inputClass = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Reads a video file's length in the browser before anything is uploaded. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    video.src = url;
  });
}

/**
 * The video goes straight from the phone to Mux in 5MB chunks (resumable:
 * a dropped connection retries the chunk instead of starting over). Only the
 * caption and details pass through our server.
 */
export function UploadForm({ listings }: { listings: ListingOption[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [listingId, setListingId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const uploadRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => () => uploadRef.current?.abort(), []);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  async function pickFile(next: File | undefined) {
    setError(null);
    setFile(null);
    setDuration(null);
    if (!next) return;
    if (next.size > MAX_VIDEO_BYTES) return setError("That file is too large.");
    try {
      const seconds = await readDuration(next);
      if (!Number.isFinite(seconds) || seconds <= 0) return setError("That file doesn't look like a playable video.");
      if (seconds > MAX_VIDEO_SECONDS + 1) return setError(`Videos can be up to 60 minutes. This one is ${formatDuration(seconds)}.`);
      setFile(next);
      setDuration(seconds);
      setPreview(URL.createObjectURL(next));
    } catch {
      // This browser can't preview the format (common with some phone videos).
      // Let it through: the 60-minute limit is still enforced after upload.
      if (!next.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i.test(next.name)) {
        return setError("That file doesn't look like a video. Try an MP4 or MOV file.");
      }
      setFile(next);
      setDuration(0);
    }
  }

  function applyListing(id: string) {
    setListingId(id);
    const listing = listings.find((l) => l.id === id);
    const form = formRef.current;
    if (!listing || !form) return;
    const set = (name: string, value: string | number | null) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el && !el.value) el.value = value == null ? "" : String(value);
    };
    set("make", listing.make);
    set("model", listing.model);
    set("year", listing.year);
    set("price", listing.price);
    set("location", listing.location);
  }

  async function pollUntilReady(videoId: string) {
    setPhase("processing");
    for (let i = 0; i < 400; i++) {
      await new Promise((r) => setTimeout(r, i < 20 ? 3000 : 8000));
      const result = await videoStatusAction(videoId);
      if (!result.ok) continue;
      if (result.data.status === "READY") {
        setPhase("done");
        router.push(`/trending/v/${videoId}`);
        return;
      }
      if (result.data.status === "FAILED") {
        setPhase("error");
        setError(result.data.failureReason ?? "We couldn't process this video.");
        return;
      }
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || duration === null) return setError("Choose a video first.");
    setError(null);
    setPhase("preparing");

    const data = new FormData(e.currentTarget);
    data.delete("video");
    data.set("durationSeconds", String(duration));
    data.set("fileSize", String(file.size));
    const cover = data.get("cover");
    if (cover instanceof File && cover.size === 0) data.delete("cover");

    const created = await createUploadAction(data);
    if (!created.ok) {
      setPhase("error");
      setError(created.error);
      return;
    }

    setPhase("uploading");
    const { UpChunk } = await import("@mux/upchunk");
    const upload = UpChunk.createUpload({ endpoint: created.data.uploadUrl, file, chunkSize: 5120, dynamicChunkSize: true });
    uploadRef.current = upload;
    upload.on("progress", (event: CustomEvent<number>) => setProgress(Math.round(event.detail)));
    upload.on("error", (event: CustomEvent<{ message?: string }>) => {
      setPhase("error");
      setError(event.detail?.message ? `Upload failed: ${event.detail.message}` : "Upload failed. Please try again.");
    });
    upload.on("success", () => {
      uploadRef.current = null;
      void pollUntilReady(created.data.videoId);
    });
  }

  const busy = phase === "preparing" || phase === "uploading" || phase === "processing" || phase === "done";

  return (
    <form ref={formRef} onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Video *</span>
        <input
          name="video"
          type="file"
          accept={ACCEPTED_VIDEO_TYPES}
          disabled={busy}
          onChange={(e) => pickFile(e.target.files?.[0])}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:font-semibold file:text-white"
        />
      </label>
      {preview && (
        <div className="flex items-center gap-3">
          <video src={preview} muted playsInline className="h-28 w-20 rounded-md bg-black object-cover" />
          <p className="text-sm text-slate-600">
            {file?.name}
            <br />
            {duration ? formatDuration(duration) : ""} · {file ? (file.size / 1024 / 1024).toFixed(0) : 0} MB
          </p>
        </div>
      )}

      <label className="block text-sm font-medium text-slate-700">
        Caption * <span className="font-normal text-slate-400">(use #hashtags)</span>
        <textarea name="caption" required rows={3} maxLength={CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={busy} className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Title <span className="font-normal text-slate-400">(optional)</span>
        <input name="title" maxLength={100} disabled={busy} className={inputClass} />
      </label>

      {listings.length > 0 && (
        <label className="block text-sm font-medium text-slate-700">
          Link one of your listings <span className="font-normal text-slate-400">(optional)</span>
          <select name="listingId" value={listingId} onChange={(e) => applyListing(e.target.value)} disabled={busy} className={inputClass}>
            <option value="">No listing</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="grid grid-cols-2 gap-3" disabled={busy}>
        <legend className="col-span-2 text-sm font-medium text-slate-700">Car details (optional)</legend>
        <input name="make" placeholder="Make (e.g. Toyota)" maxLength={40} className={inputClass} />
        <input name="model" placeholder="Model (e.g. Harrier)" maxLength={40} className={inputClass} />
        <input name="year" placeholder="Year" inputMode="numeric" maxLength={4} className={inputClass} />
        <input name="price" placeholder="Price (KES)" inputMode="numeric" maxLength={14} className={inputClass} />
        <input name="location" placeholder="Location" maxLength={60} className={`${inputClass} col-span-2`} />
      </fieldset>

      <label className="block text-sm font-medium text-slate-700">
        Cover image <span className="font-normal text-slate-400">(optional — we pick a frame from the video otherwise)</span>
        <input name="cover" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-1 block w-full text-sm" />
      </label>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {phase === "uploading" && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">Uploading… {progress}% — keep this page open.</p>
        </div>
      )}
      {phase === "processing" && (
        <p className="rounded-md bg-brand-subtle px-3 py-2 text-sm text-slate-700">
          Processing… we&apos;re resizing your video so it plays fast on every phone. This can take a few minutes for long videos.
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !file || !caption.trim()}
        className="w-full rounded-md bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {phase === "preparing" ? "Preparing…" : phase === "uploading" ? `Uploading ${progress}%` : phase === "processing" ? "Processing…" : "Post video"}
      </button>
    </form>
  );
}

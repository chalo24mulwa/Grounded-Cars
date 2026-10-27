"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  createListingFormAction,
  updateListingFormAction,
  type ListingFormState,
} from "@/server/actions/listing-actions";
import { compressImageForUpload } from "@/lib/client-image";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-sm font-medium text-slate-700";

const currentYear = new Date().getFullYear();
const initialState: ListingFormState = {};

// Same file-type/size hints shown by the edit page's ImageManager — the
// server (src/lib/storage.ts) is still the authoritative validator either
// way.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_MB = 5;
const MAX_PHOTOS = 10;

type ListingDefaults = {
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number | string;
  currency?: string;
  mileage?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  engineSize?: string | null;
  bodyType?: string | null;
  color?: string | null;
  location?: string | null;
  description?: string | null;
  condition?: string | null;
  classifications?: string[] | null;
  category?: string | null;
};

type StagedPhoto = {
  key: string;
  file: File;
  previewUrl: string;
  /** "ready" = already uploaded (token issued); "failed" = will be sent with
   * the form instead, the original way. */
  status: "uploading" | "ready" | "failed";
  token?: string;
};

const CLASSIFICATION_OPTIONS = [
  { value: "GROUNDED", label: "Grounded" },
  { value: "SALVAGE", label: "Salvage" },
  { value: "AUCTION", label: "Auction" },
  { value: "OLD_SCHOOL", label: "Old School" },
];

const CATEGORY_OPTIONS = [
  { value: "CARS", label: "Cars" },
  { value: "SUV_TRUCKS", label: "SUV & Trucks" },
  { value: "LORRIES_BUSES", label: "Lorries and Buses" },
  { value: "EV_CARS", label: "Electric Vehicles" },
  { value: "EV_BIKES", label: "Electric Bikes" },
];

export function ListingForm({
  mode,
  listingId,
  defaults,
}: {
  mode: "create" | "edit";
  listingId?: string;
  defaults?: ListingDefaults;
}) {
  const action =
    mode === "create" ? createListingFormAction : updateListingFormAction.bind(null, listingId!);
  const [state, formAction, pending] = useActionState(action, initialState);

  // Create-mode only: photos are picked up front and staged here as real
  // File objects, then handed to the server in the same submission as the
  // rest of the form — createListingFormAction saves the listing first,
  // then uploads these in order via the same addListingImage() the edit
  // page's photo manager already uses.
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Counts photo batches still being shrunk in the browser; submitting while
  // any are in flight would silently leave those photos out.
  const [preparing, setPreparing] = useState(0);
  const [clickedIntent, setClickedIntent] = useState<"submit" | "draft" | null>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  // Fast submit (create mode, see src/server/services/listing-fast-submit.ts):
  // each photo is uploaded the moment it's picked, so Submit only has to send
  // the form text and returns in a fraction of a second. If anything about
  // that fails, the form falls back to the original full upload on Submit.
  const router = useRouter();
  const pendingRef = useRef<{ pid: string; pidSig: string } | null>(null);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const photosRef = useRef<StagedPhoto[]>([]);
  photosRef.current = photos;
  const [fastBusy, setFastBusy] = useState<string | null>(null);
  const [fastError, setFastError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  function uploadPhoto(photo: StagedPhoto) {
    uploadQueueRef.current = uploadQueueRef.current.then(async () => {
      // Removed before its turn came: nothing to upload.
      if (!photosRef.current.some((p) => p.key === photo.key)) return;
      const body = new FormData();
      body.set("file", photo.file);
      if (pendingRef.current) {
        body.set("pid", pendingRef.current.pid);
        body.set("pidSig", pendingRef.current.pidSig);
      }
      let token: string | undefined;
      try {
        const res = await fetch("/api/listings/staged-photos", { method: "POST", body });
        if (res.ok) {
          const data = (await res.json()) as { pid: string; pidSig: string; token: string };
          pendingRef.current = { pid: data.pid, pidSig: data.pidSig };
          token = data.token;
        }
      } catch {
        /* offline / dropped: falls back to uploading with the form */
      }
      setPhotos((prev) =>
        prev.map((p) => (p.key === photo.key ? { ...p, token, status: token ? "ready" : "failed" } : p))
      );
      // Removed while it was uploading: tidy up the uploaded copy.
      if (token && !photosRef.current.some((p) => p.key === photo.key)) discardStagedPhoto(token);
    });
  }

  function discardStagedPhoto(token: string) {
    void fetch("/api/listings/staged-photos", {
      method: "DELETE",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => undefined);
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value === "draft" ? "draft" : "submit";
    setClickedIntent(intent);
    setFastError(null);
    const formData = new FormData(form);
    formData.set("intent", intent);

    const submitTheOriginalWay = () => startTransition(() => formAction(formData));

    // Photos still on their way up: wait for them (usually a moment).
    if (photosRef.current.some((p) => p.status === "uploading")) {
      setFastBusy("Uploading photos…");
      await uploadQueueRef.current;
    }
    const current = photosRef.current;
    if (current.some((p) => p.status !== "ready")) {
      setFastBusy(null);
      submitTheOriginalWay();
      return;
    }

    setFastBusy(intent === "submit" ? "Submitting…" : "Saving…");
    const fields: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === "string" && key !== "intent") fields[key] = value;
    });
    const payload = JSON.stringify({
      fields,
      intent,
      pending: pendingRef.current,
      photoTokens: current.map((p) => p.token),
    });

    let response: Response;
    try {
      // keepalive: the browser finishes sending this even if the seller
      // closes or leaves the page right after clicking.
      response = await fetch("/api/listings/quick-create", {
        method: "POST",
        keepalive: payload.length < 60_000,
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
    } catch {
      setFastBusy(null);
      submitTheOriginalWay();
      return;
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string; redirectTo?: string; error?: string };
    if (!response.ok || !data.id || !data.redirectTo) {
      setFastBusy(null);
      setFastError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    if (intent === "submit") {
      setFastBusy(null);
      setSubmittedId(data.id);
      router.prefetch(`/dashboard/listings/${data.id}/edit`);
    } else {
      setFastBusy("Draft saved — opening it…");
      router.push(data.redirectTo);
    }
  }

  useEffect(() => {
    if (!photosInputRef.current) return;
    const dataTransfer = new DataTransfer();
    photos.forEach(({ file }) => dataTransfer.items.add(file));
    photosInputRef.current.files = dataTransfer.files;
  }, [photos]);

  // Revoke every staged preview URL on unmount so a seller navigating away
  // mid-selection doesn't leak object URLs.
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhotoPick(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const incoming = Array.from(fileList).slice(0, Math.max(0, room));
    setPhotoError(fileList.length > incoming.length ? `You can add up to ${MAX_PHOTOS} photos.` : null);
    if (incoming.length === 0) return;

    // Shrunk in the browser before staging so the actual submit uploads a few
    // hundred KB per photo instead of the multi-MB originals — the biggest
    // single factor in how long "Submit" takes on a mobile connection.
    setPreparing((n) => n + 1);
    try {
      const prepared = await Promise.all(incoming.map(compressImageForUpload));
      const staged: StagedPhoto[] = prepared.map((file) => ({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      }));
      const accepted = staged.slice(0, Math.max(0, MAX_PHOTOS - photosRef.current.length));
      photosRef.current = [...photosRef.current, ...accepted];
      setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
      accepted.forEach(uploadPhoto);
    } finally {
      setPreparing((n) => n - 1);
    }
  }

  function removePhoto(index: number) {
    setPhotoError(null);
    const target = photosRef.current[index];
    if (target?.token) discardStagedPhoto(target.token);
    if (target) photosRef.current = photosRef.current.filter((p) => p.key !== target.key);
    setPhotos((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  if (submittedId) {
    // Same message and link as the /submitted page; shown immediately.
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center" role="status">
          <p className="text-lg font-semibold text-slate-900">
            Listing submitted for review — an admin will review it shortly.
          </p>
          <Link
            href={`/dashboard/listings/${submittedId}/edit`}
            className="mt-6 inline-block rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            Edit Listing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={mode === "create" ? handleCreateSubmit : undefined}
      className="space-y-8"
    >
      {fastError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {fastError}
        </p>
      )}
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-status-active/10 px-3 py-2 text-sm text-status-active">
          Your car listing has been saved successfully.
        </p>
      )}

      {mode === "create" && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Photos</h2>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-brand">
            <span className="text-sm font-medium text-slate-700">Click to upload photos</span>
            <span className="mt-1 text-xs text-slate-500">
              JPEG, PNG, or WebP — up to {MAX_MB}MB each. First photo becomes the cover image. Up to{" "}
              {MAX_PHOTOS} photos.
            </span>
            <input
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              className="hidden"
              onChange={(e) => {
                handlePhotoPick(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {/* The visible picker above never touches form submission directly
              (each pick replaces its own FileList) — this hidden input's
              files are kept in sync with `photos` via DataTransfer so the
              full staged set submits together as "photos". */}
          <input ref={photosInputRef} type="file" name="photos" multiple className="hidden" />

          {photoError && <p className="mt-2 text-xs text-red-600">{photoError}</p>}
          {preparing > 0 && (
            <p className="mt-2 text-xs text-slate-500" role="status">
              Preparing photos…
            </p>
          )}

          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map(({ key, previewUrl, status }, index) => (
                <div key={key} className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="relative aspect-square bg-slate-100">
                    <Image
                      src={previewUrl}
                      alt={`Photo ${index + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="200px"
                    />
                    {index === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        Cover
                      </span>
                    )}
                    {status === "uploading" && (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Uploading…
                      </span>
                    )}
                    {status === "ready" && (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-status-active px-1.5 py-0.5 text-[10px] font-medium text-white" aria-label="Uploaded">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Basic Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className={labelClass}>
              Listing title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              minLength={5}
              defaultValue={defaults?.title}
              placeholder="e.g. 2019 Toyota Axio — Well Maintained"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="make" className={labelClass}>
              Make
            </label>
            <input id="make" name="make" type="text" required defaultValue={defaults?.make} className={inputClass} />
          </div>
          <div>
            <label htmlFor="model" className={labelClass}>
              Model
            </label>
            <input
              id="model"
              name="model"
              type="text"
              required
              defaultValue={defaults?.model}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="year" className={labelClass}>
              Year
            </label>
            <input
              id="year"
              name="year"
              type="number"
              required
              min={1970}
              max={currentYear + 1}
              defaultValue={defaults?.year}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="price" className={labelClass}>
              Price (KES)
            </label>
            <input
              id="price"
              name="price"
              type="number"
              required
              min={1}
              step="0.01"
              defaultValue={defaults?.price !== undefined ? String(defaults.price) : undefined}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="condition" className={labelClass}>
              Condition
            </label>
            <select id="condition" name="condition" defaultValue={defaults?.condition ?? ""} className={inputClass}>
              <option value="">Select condition</option>
              <option value="BRAND_NEW">Brand new</option>
              <option value="FOREIGN_USED">Foreign used</option>
              <option value="LOCALLY_USED">Locally used</option>
            </select>
          </div>
          <div>
            <label htmlFor="location" className={labelClass}>
              Vehicle location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="e.g. Nairobi"
              defaultValue={defaults?.location ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="category" className={labelClass}>
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue={defaults?.category ?? ""}
              className={inputClass}
            >
              <option value="" disabled>
                Select a category
              </option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-xs text-slate-500">
              Shown in the &quot;Find a Car&quot; menu and used to match related vehicles.
            </p>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className={labelClass}>
              Classification <span className="text-red-500">*</span>
            </legend>
            <p className="mt-0.5 text-xs text-slate-500">
              Select at least one — shown as tags on the listing so buyers know at a glance. You can select more
              than one (e.g. Grounded + Salvage).
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CLASSIFICATION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 has-[:checked]:border-brand has-[:checked]:bg-brand/5 has-[:checked]:text-brand"
                >
                  <input
                    type="checkbox"
                    name="classifications"
                    value={option.value}
                    defaultChecked={defaults?.classifications?.includes(option.value) ?? false}
                    className="h-4 w-4 accent-brand"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Vehicle Specifications</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mileage" className={labelClass}>
              Mileage (km)
            </label>
            <input
              id="mileage"
              name="mileage"
              type="number"
              min={0}
              defaultValue={defaults?.mileage ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="transmission" className={labelClass}>
              Transmission
            </label>
            <select
              id="transmission"
              name="transmission"
              defaultValue={defaults?.transmission ?? ""}
              className={inputClass}
            >
              <option value="">Select transmission</option>
              <option value="MANUAL">Manual</option>
              <option value="AUTOMATIC">Automatic</option>
              <option value="CVT">CVT</option>
              <option value="SEMI_AUTOMATIC">Semi-automatic</option>
            </select>
          </div>
          <div>
            <label htmlFor="fuelType" className={labelClass}>
              Fuel type
            </label>
            <select id="fuelType" name="fuelType" defaultValue={defaults?.fuelType ?? ""} className={inputClass}>
              <option value="">Select fuel type</option>
              <option value="PETROL">Petrol</option>
              <option value="DIESEL">Diesel</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ELECTRIC">Electric</option>
              <option value="LPG">LPG</option>
            </select>
          </div>
          <div>
            <label htmlFor="engineSize" className={labelClass}>
              Engine size
            </label>
            <input
              id="engineSize"
              name="engineSize"
              type="text"
              placeholder="e.g. 1500cc"
              defaultValue={defaults?.engineSize ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bodyType" className={labelClass}>
              Body type
            </label>
            <input
              id="bodyType"
              name="bodyType"
              type="text"
              placeholder="e.g. Sedan, SUV"
              defaultValue={defaults?.bodyType ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="color" className={labelClass}>
              Color
            </label>
            <input
              id="color"
              name="color"
              type="text"
              defaultValue={defaults?.color ?? ""}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Description</h2>
        <label htmlFor="description" className={labelClass}>
          Tell buyers about this vehicle
        </label>
        <textarea
          id="description"
          name="description"
          rows={8}
          maxLength={5000}
          defaultValue={defaults?.description ?? ""}
          placeholder={
            "Condition — e.g. dents, service history, tyre condition...\n" +
            "Special features — e.g. sunroof, leather seats, reverse camera...\n" +
            "Service history — e.g. regularly serviced at an authorized garage...\n" +
            "Modifications — list any, or note the vehicle is unmodified...\n" +
            "Anything buyers should know about the price"
          }
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500">
          Covering condition, features, service history, and modifications helps your listing get
          approved faster and builds buyer trust.
        </p>
      </section>

      {mode === "create" ? (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="submit"
            disabled={pending || preparing > 0 || fastBusy !== null}
            onClick={() => setClickedIntent("submit")}
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
          >
            {fastBusy && clickedIntent === "submit"
              ? fastBusy
              : pending && clickedIntent === "submit"
                ? "Submitting…"
                : "Submit"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending || preparing > 0 || fastBusy !== null}
            onClick={() => setClickedIntent("draft")}
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-brand-subtle disabled:opacity-60"
          >
            {fastBusy && clickedIntent === "draft"
              ? fastBusy
              : pending && clickedIntent === "draft"
                ? "Saving…"
                : "Save as Draft"}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      )}
    </form>
  );
}

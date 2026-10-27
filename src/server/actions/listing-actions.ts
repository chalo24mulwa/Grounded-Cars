"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createListing,
  updateListing,
  markListingAsSold,
  restoreListingToActive,
  submitListingForReview,
  archiveListing,
  restoreListingToDraft,
  addListingImage,
  addListingImages,
  removeListingImage,
  reorderListingImages,
  setPrimaryListingImage,
} from "@/server/services/listing-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { InvalidStatusTransitionError } from "@/server/services/listing-status";
import { InvalidImageError } from "@/lib/storage";
import { RateLimitError } from "@/server/services/rate-limit";
import { ZodError } from "zod";
import {
  createListingSchema,
  updateListingSchema,
  type CreateListingInput,
  type UpdateListingInput,
} from "@/server/validation/listing-schema";

// ----------------------------------------------------------------------------
// Server actions stay thin: parse/forward input to a service function,
// translate known errors into a user-safe message, revalidate affected
// paths. No business logic, no Prisma calls, and no ownership checks here —
// those live in the service + authorization layers so they can't be
// bypassed by a different entry point later.
// ----------------------------------------------------------------------------

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof InvalidStatusTransitionError) return error.message;
  if (error instanceof InvalidImageError) return error.message;
  if (error instanceof RateLimitError) return error.message;
  if (error instanceof ZodError) {
    return error.errors[0]?.message ?? "Some fields are invalid. Please check and try again.";
  }
  // Anything else is unexpected — log server-side, never leak details to the client.
  console.error("Unhandled error in listing action:", error);
  return "Something went wrong. Please try again, or contact support if this continues.";
}

// Form-bound state shape for the multi-section listing form and image
// manager (useActionState), distinct from the ActionResult<T> shape below
// used by simple imperative button actions — same dual pattern already
// established for auth in Phase 2 (AuthActionState vs. direct calls).
export type ListingFormState = { error?: string; success?: boolean };

function parseListingFormData(formData: FormData) {
  const str = (key: string): string | undefined => {
    const v = formData.get(key);
    return v === null || v === "" ? undefined : String(v);
  };
  const num = (key: string): number | undefined => {
    const v = formData.get(key);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };
  // Checkbox groups share one `name` — FormData.getAll collects every
  // checked value under that key (empty array when none are checked).
  const arr = (key: string): string[] => formData.getAll(key).map(String);

  return {
    title: str("title") ?? "",
    make: str("make") ?? "",
    model: str("model") ?? "",
    year: num("year") ?? 0,
    price: num("price") ?? 0,
    currency: str("currency") ?? "KES",
    mileage: num("mileage"),
    transmission: str("transmission"),
    fuelType: str("fuelType"),
    engineSize: str("engineSize"),
    bodyType: str("bodyType"),
    color: str("color"),
    location: str("location"),
    description: str("description"),
    condition: str("condition"),
    classifications: arr("classifications"),
    category: str("category"),
  };
}

export async function createListingAction(
  input: CreateListingInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const listing = await createListing(input);
    revalidatePath("/dashboard/listings");
    return { success: true, data: { id: listing.id, slug: listing.slug } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function updateListingAction(
  listingId: string,
  input: UpdateListingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const listing = await updateListing(listingId, input);
    revalidatePath("/dashboard/listings");
    revalidatePath(`/cars/${listing.slug}`);
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function markAsSoldAction(listingId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const listing = await markListingAsSold(listingId);
    revalidatePath("/dashboard/listings");
    revalidatePath(`/cars/${listing.slug}`);
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function restoreToActiveAction(
  listingId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const listing = await restoreListingToActive(listingId);
    revalidatePath("/dashboard/listings");
    revalidatePath(`/cars/${listing.slug}`);
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function submitForReviewAction(
  listingId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const listing = await submitListingForReview(listingId);
    revalidatePath("/dashboard/listings");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function archiveListingAction(
  listingId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const listing = await archiveListing(listingId);
    revalidatePath("/dashboard/listings");
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function restoreToDraftAction(
  listingId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const listing = await restoreListingToDraft(listingId);
    revalidatePath("/dashboard/listings");
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

// ----------------------------------------------------------------------------
// Form-bound actions (useActionState). listingId is supplied via
// Function.prototype.bind on the client ("new" listings don't have one yet,
// so createListingFormAction doesn't take it) — same pattern as any action
// needing an id beyond (prevState, formData).
// ----------------------------------------------------------------------------

export async function createListingFormAction(
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const parsed = createListingSchema.safeParse(parseListingFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Please check the form and try again." };
  }

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const intent = formData.get("intent") === "submit" ? "submit" : "draft";

  let listing;
  try {
    listing = await createListing(parsed.data);

    // Uploaded in selection order — the first photo becomes the cover image,
    // same as addListingImage does for any listing. Done as one batch (see
    // addListingImages) rather than a per-photo loop, which repeated the
    // ownership check and photo count for every single photo.
    await addListingImages(listing.id, photos);

    if (intent === "submit") {
      await submitListingForReview(listing.id);
    }
  } catch (error) {
    return { error: toUserSafeError(error) };
  }

  revalidatePath("/dashboard/listings");
  if (intent === "submit") {
    redirect(`/dashboard/listings/${listing.id}/submitted`);
  }
  redirect(`/dashboard/listings/${listing.id}/edit?created=1`);
}

export async function updateListingFormAction(
  listingId: string,
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const parsed = updateListingSchema.safeParse(parseListingFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Please check the form and try again." };
  }

  try {
    const listing = await updateListing(listingId, parsed.data);
    revalidatePath("/dashboard/listings");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    revalidatePath(`/cars/${listing.slug}`);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }

  return { success: true };
}

export async function uploadListingImageAction(
  listingId: string,
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image to upload." };
  }

  try {
    await addListingImage(listingId, file);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { success: true };
}

export async function removeListingImageAction(
  listingId: string,
  imageId: string
): Promise<ActionResult<null>> {
  try {
    await removeListingImage(listingId, imageId);
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function setPrimaryImageAction(
  listingId: string,
  imageId: string
): Promise<ActionResult<null>> {
  try {
    await setPrimaryListingImage(listingId, imageId);
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function reorderListingImagesAction(
  listingId: string,
  orderedImageIds: string[]
): Promise<ActionResult<null>> {
  try {
    await reorderListingImages(listingId, orderedImageIds);
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

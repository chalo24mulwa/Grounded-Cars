"use server";

import { revalidatePath } from "next/cache";
import {
  createCsrInitiative,
  updateCsrInitiative,
  setCsrInitiativePublished,
  setCsrInitiativeStatus,
  addCsrInitiativeImage,
  removeCsrInitiativeImage,
  initiateCsrDonation,
  devSimulateCsrDonationCallback,
  InvalidImageError,
  InitiativeNotFoundError,
  InitiativeNotAcceptingDonationsError,
} from "@/server/services/csr-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { MpesaNotConfiguredError, MpesaRequestError } from "@/lib/mpesa";
import { RateLimitError } from "@/server/services/rate-limit";
import type { CsrInitiativeStatus } from "@prisma/client";
import { ZodError } from "zod";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof InvalidImageError) return error.message;
  if (error instanceof InitiativeNotFoundError) return error.message;
  if (error instanceof InitiativeNotAcceptingDonationsError) return error.message;
  if (error instanceof MpesaNotConfiguredError) return error.message;
  if (error instanceof MpesaRequestError) return error.message;
  if (error instanceof RateLimitError) return error.message;
  if (error instanceof ZodError) return error.errors[0]?.message ?? "Please check the form.";
  console.error("Unhandled error in CSR action:", error);
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Admin: initiative CRUD
// ---------------------------------------------------------------------------

export type CsrFormState = { error?: string; success?: boolean };

function readCsrFormData(formData: FormData) {
  const str = (key: string) => {
    const v = formData.get(key);
    return v === null || v === "" ? undefined : String(v);
  };
  return {
    title: str("title") ?? "",
    summary: str("summary") ?? "",
    story: str("story") ?? "",
    targetAmount: str("targetAmount") ?? "",
    startDate: str("startDate"),
    endDate: str("endDate"),
  };
}

export async function createCsrInitiativeFormAction(
  _prevState: CsrFormState,
  formData: FormData
): Promise<CsrFormState> {
  const file = formData.get("coverImage");
  try {
    await createCsrInitiative(readCsrFormData(formData), file instanceof File ? file : null);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/csr");
  revalidatePath("/csr");
  return { success: true };
}

export async function updateCsrInitiativeFormAction(
  initiativeId: string,
  _prevState: CsrFormState,
  formData: FormData
): Promise<CsrFormState> {
  const file = formData.get("coverImage");
  try {
    await updateCsrInitiative(initiativeId, readCsrFormData(formData), file instanceof File ? file : null);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/csr");
  revalidatePath(`/admin/csr/${initiativeId}/edit`);
  revalidatePath("/csr");
  return { success: true };
}

export async function setCsrInitiativePublishedAction(
  initiativeId: string,
  published: boolean
): Promise<ActionResult<null>> {
  try {
    await setCsrInitiativePublished(initiativeId, published);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/csr");
  revalidatePath("/csr");
  return { success: true, data: null };
}

export async function setCsrInitiativeStatusAction(
  initiativeId: string,
  status: CsrInitiativeStatus
): Promise<ActionResult<null>> {
  try {
    await setCsrInitiativeStatus(initiativeId, status);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/csr");
  revalidatePath("/csr");
  return { success: true, data: null };
}

// ---------------------------------------------------------------------------
// Admin: gallery images
// ---------------------------------------------------------------------------

export async function uploadCsrInitiativeImageAction(
  initiativeId: string,
  _prevState: CsrFormState,
  formData: FormData
): Promise<CsrFormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image to upload." };
  }

  try {
    await addCsrInitiativeImage(initiativeId, file);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }

  revalidatePath(`/admin/csr/${initiativeId}/edit`);
  return { success: true };
}

export async function removeCsrInitiativeImageAction(
  initiativeId: string,
  imageId: string
): Promise<ActionResult<null>> {
  try {
    await removeCsrInitiativeImage(initiativeId, imageId);
    revalidatePath(`/admin/csr/${initiativeId}/edit`);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

// ---------------------------------------------------------------------------
// Public: donations
// ---------------------------------------------------------------------------

export type DonateFormState = { error?: string; success?: boolean; donationId?: string };

export async function initiateCsrDonationFormAction(
  _prevState: DonateFormState,
  formData: FormData
): Promise<DonateFormState> {
  try {
    const { donationId } = await initiateCsrDonation({
      initiativeId: String(formData.get("initiativeId") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      donorPhone: String(formData.get("donorPhone") ?? ""),
      donorName: String(formData.get("donorName") ?? "") || undefined,
      donorEmail: String(formData.get("donorEmail") ?? "") || undefined,
    });
    return { success: true, donationId };
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
}

/** DEV/TEST ONLY — see devSimulateCsrDonationCallback() in csr-service.ts.
 * Hard-blocked server-side outside development regardless of what calls it. */
export async function devSimulateCsrDonationAction(
  donationId: string,
  outcome: "success" | "failure"
): Promise<ActionResult<null>> {
  try {
    await devSimulateCsrDonationCallback(donationId, outcome);
    revalidatePath("/csr");
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

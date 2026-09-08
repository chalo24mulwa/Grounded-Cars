"use server";

import { revalidatePath } from "next/cache";
import {
  createInsurancePolicy,
  updateInsurancePolicy,
  setInsurancePolicyPublished,
  archiveInsurancePolicy,
  unarchiveInsurancePolicy,
  initiateInsurancePurchase,
  devSimulateInsurancePurchaseCallback,
  InvalidImageError,
  InsurancePolicyNotFoundError,
  InsurancePolicyNotOrderableError,
} from "@/server/services/insurance-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { MpesaNotConfiguredError, MpesaRequestError } from "@/lib/mpesa";
import { RateLimitError } from "@/server/services/rate-limit";
import { ZodError } from "zod";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof InvalidImageError) return error.message;
  if (error instanceof InsurancePolicyNotFoundError) return error.message;
  if (error instanceof InsurancePolicyNotOrderableError) return error.message;
  if (error instanceof MpesaNotConfiguredError) return error.message;
  if (error instanceof MpesaRequestError) return error.message;
  if (error instanceof RateLimitError) return error.message;
  if (error instanceof ZodError) return error.errors[0]?.message ?? "Please check the form.";
  console.error("Unhandled error in insurance action:", error);
  return "Something went wrong. Please try again.";
}

export type InsuranceFormState = { error?: string; success?: boolean };

function readInsuranceFormData(formData: FormData) {
  const str = (key: string) => {
    const v = formData.get(key);
    return v === null || v === "" ? undefined : String(v);
  };
  return {
    title: str("title") ?? "",
    description: str("description") ?? "",
    startingPrice: str("startingPrice") ?? "",
  };
}

export async function createInsurancePolicyFormAction(
  _prevState: InsuranceFormState,
  formData: FormData
): Promise<InsuranceFormState> {
  const file = formData.get("image");
  try {
    await createInsurancePolicy(readInsuranceFormData(formData), file instanceof File ? file : null);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/insurance");
  revalidatePath("/services/car-insurance");
  return { success: true };
}

export async function updateInsurancePolicyFormAction(
  policyId: string,
  _prevState: InsuranceFormState,
  formData: FormData
): Promise<InsuranceFormState> {
  const file = formData.get("image");
  try {
    await updateInsurancePolicy(policyId, readInsuranceFormData(formData), file instanceof File ? file : null);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/insurance");
  revalidatePath(`/admin/insurance/${policyId}/edit`);
  revalidatePath("/services/car-insurance");
  return { success: true };
}

export async function setInsurancePolicyPublishedAction(
  policyId: string,
  published: boolean
): Promise<ActionResult<null>> {
  try {
    await setInsurancePolicyPublished(policyId, published);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/insurance");
  revalidatePath("/services/car-insurance");
  return { success: true, data: null };
}

export async function archiveInsurancePolicyAction(policyId: string): Promise<ActionResult<null>> {
  try {
    await archiveInsurancePolicy(policyId);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/insurance");
  revalidatePath("/services/car-insurance");
  return { success: true, data: null };
}

export async function unarchiveInsurancePolicyAction(policyId: string): Promise<ActionResult<null>> {
  try {
    await unarchiveInsurancePolicy(policyId);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/insurance");
  return { success: true, data: null };
}

// ---------------------------------------------------------------------------
// Public: purchasing
// ---------------------------------------------------------------------------

export type InsurancePurchaseFormState = { error?: string; success?: boolean; purchaseId?: string };

export async function initiateInsurancePurchaseFormAction(
  _prevState: InsurancePurchaseFormState,
  formData: FormData
): Promise<InsurancePurchaseFormState> {
  try {
    const { purchaseId } = await initiateInsurancePurchase({
      policyId: String(formData.get("policyId") ?? ""),
      customerPhone: String(formData.get("customerPhone") ?? ""),
      customerName: String(formData.get("customerName") ?? "") || undefined,
      customerEmail: String(formData.get("customerEmail") ?? "") || undefined,
    });
    return { success: true, purchaseId };
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
}

/** DEV/TEST ONLY — see devSimulateInsurancePurchaseCallback() in
 * insurance-service.ts. Hard-blocked server-side outside development
 * regardless of what calls it. */
export async function devSimulateInsurancePurchaseAction(
  purchaseId: string,
  outcome: "success" | "failure"
): Promise<ActionResult<null>> {
  try {
    await devSimulateInsurancePurchaseCallback(purchaseId, outcome);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

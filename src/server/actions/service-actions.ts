"use server";

import { revalidatePath } from "next/cache";
import {
  createService,
  updateService,
  setServicePublished,
  addServiceImage,
  removeServiceImage,
  initiateServiceOrder,
  devSimulateServiceOrderCallback,
  InvalidImageError,
  ServiceNotFoundError,
  ServiceNotOrderableError,
  DuplicateServiceSlugError,
} from "@/server/services/service-catalog-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { MpesaNotConfiguredError, MpesaRequestError } from "@/lib/mpesa";
import { RateLimitError } from "@/server/services/rate-limit";
import { CouponNotFoundError, CouponUsageLimitExceededError } from "@/server/services/coupon-service";
import { ZodError } from "zod";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof InvalidImageError) return error.message;
  if (error instanceof ServiceNotFoundError) return error.message;
  if (error instanceof ServiceNotOrderableError) return error.message;
  if (error instanceof DuplicateServiceSlugError) return error.message;
  if (error instanceof CouponNotFoundError) return error.message;
  if (error instanceof CouponUsageLimitExceededError) return error.message;
  if (error instanceof MpesaNotConfiguredError) return error.message;
  if (error instanceof MpesaRequestError) return error.message;
  if (error instanceof RateLimitError) return error.message;
  if (error instanceof ZodError) return error.errors[0]?.message ?? "Please check the form.";
  console.error("Unhandled error in service action:", error);
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Admin: service catalog CRUD
// ---------------------------------------------------------------------------

export type ServiceFormState = { error?: string; success?: boolean };

function readServiceFormData(formData: FormData) {
  const str = (key: string) => {
    const v = formData.get(key);
    return v === null || v === "" ? undefined : String(v);
  };
  return {
    slug: str("slug") ?? "",
    title: str("title") ?? "",
    description: str("description") ?? "",
    price: str("price") ?? "",
  };
}

export async function createServiceFormAction(
  _prevState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  try {
    await createService(readServiceFormData(formData));
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/services");
  return { success: true };
}

export async function updateServiceFormAction(
  serviceId: string,
  _prevState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const data = readServiceFormData(formData);
  try {
    await updateService(serviceId, { title: data.title, description: data.description, price: data.price });
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${serviceId}/edit`);
  return { success: true };
}

export async function setServicePublishedAction(
  serviceId: string,
  published: boolean
): Promise<ActionResult<null>> {
  try {
    await setServicePublished(serviceId, published);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/services");
  return { success: true, data: null };
}

// ---------------------------------------------------------------------------
// Admin: gallery images
// ---------------------------------------------------------------------------

export async function uploadServiceImageAction(
  serviceId: string,
  _prevState: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image to upload." };
  }

  try {
    await addServiceImage(serviceId, file);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }

  revalidatePath(`/admin/services/${serviceId}/edit`);
  return { success: true };
}

export async function removeServiceImageAction(
  serviceId: string,
  imageId: string
): Promise<ActionResult<null>> {
  try {
    await removeServiceImage(serviceId, imageId);
    revalidatePath(`/admin/services/${serviceId}/edit`);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

// ---------------------------------------------------------------------------
// Public: ordering
// ---------------------------------------------------------------------------

export type OrderFormState = { error?: string; success?: boolean; orderId?: string; free?: boolean };

export async function initiateServiceOrderFormAction(
  _prevState: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  try {
    const { orderId, free } = await initiateServiceOrder({
      serviceId: String(formData.get("serviceId") ?? ""),
      customerPhone: String(formData.get("customerPhone") ?? ""),
      customerName: String(formData.get("customerName") ?? "") || undefined,
      customerEmail: String(formData.get("customerEmail") ?? "") || undefined,
      couponCode: String(formData.get("couponCode") ?? "") || undefined,
    });
    return { success: true, orderId, free };
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
}

/** DEV/TEST ONLY — see devSimulateServiceOrderCallback() in
 * service-catalog-service.ts. Hard-blocked server-side outside development
 * regardless of what calls it. */
export async function devSimulateServiceOrderAction(
  orderId: string,
  outcome: "success" | "failure"
): Promise<ActionResult<null>> {
  try {
    await devSimulateServiceOrderCallback(orderId, outcome);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

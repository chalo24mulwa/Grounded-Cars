"use server";

import { revalidatePath } from "next/cache";
import {
  createInquiry,
  updateInquiryStatus,
  ListingNotAvailableError,
  ListingNotFoundError,
  DuplicateInquiryError,
} from "@/server/services/inquiry-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { RateLimitError } from "@/server/services/rate-limit";
import { ZodError } from "zod";
import type { InquiryStatus } from "@prisma/client";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export type InquiryFormState = { error?: string; success?: boolean };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in to contact the seller.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof ListingNotFoundError) return error.message;
  if (error instanceof ListingNotAvailableError) return error.message;
  if (error instanceof DuplicateInquiryError) return error.message;
  if (error instanceof RateLimitError) return error.message;
  if (error instanceof ZodError) {
    return error.errors[0]?.message ?? "Please check your message and try again.";
  }
  console.error("Unhandled error in inquiry action:", error);
  return "Something went wrong. Please try again.";
}

export async function createInquiryAction(
  _prevState: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  try {
    await createInquiry({
      listingId: String(formData.get("listingId") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/dashboard/inquiries");
  return { success: true };
}

export async function updateInquiryStatusAction(
  inquiryId: string,
  status: InquiryStatus
): Promise<ActionResult<null>> {
  try {
    await updateInquiryStatus(inquiryId, status);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/dashboard/inquiries");
  return { success: true, data: null };
}

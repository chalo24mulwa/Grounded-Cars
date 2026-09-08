"use server";

import { revalidatePath } from "next/cache";
import {
  startFeatureSubscription,
  devSimulateMpesaCallback,
  ListingNotActiveError,
  PlanNotFoundError,
} from "@/server/services/featured-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { MpesaNotConfiguredError, MpesaRequestError } from "@/lib/mpesa";
import { RateLimitError } from "@/server/services/rate-limit";
import { CouponNotFoundError, CouponUsageLimitExceededError } from "@/server/services/coupon-service";
import { ZodError } from "zod";

export type FeatureActionState = {
  error?: string;
  success?: boolean;
  subscriptionId?: string;
  free?: boolean;
};

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof ListingNotActiveError) return error.message;
  if (error instanceof PlanNotFoundError) return error.message;
  if (error instanceof CouponNotFoundError) return error.message;
  if (error instanceof CouponUsageLimitExceededError) return error.message;
  if (error instanceof MpesaNotConfiguredError) return error.message;
  if (error instanceof MpesaRequestError) return error.message;
  if (error instanceof RateLimitError) return error.message;
  if (error instanceof ZodError) {
    return error.errors[0]?.message ?? "Please check the form and try again.";
  }
  console.error("Unhandled error in featured action:", error);
  return "Something went wrong. Please try again, or contact support if this continues.";
}

export async function startFeatureAction(
  _prevState: FeatureActionState,
  formData: FormData
): Promise<FeatureActionState> {
  try {
    const { subscriptionId, free } = await startFeatureSubscription({
      listingId: String(formData.get("listingId") ?? ""),
      planId: String(formData.get("planId") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
      couponCode: String(formData.get("couponCode") ?? "") || undefined,
    });
    return { success: true, subscriptionId, free };
  } catch (error) {
    return { error: toUserSafeError(error) };
  } finally {
    // Runs on both outcomes: even a failed attempt creates a PAYMENT_FAILED
    // subscription + FAILED payment row (see startFeatureSubscription's own
    // catch block) that the history table below should show immediately,
    // not just on the next unrelated navigation.
    revalidatePath("/dashboard/featured");
  }
}

/** DEV/TEST ONLY — see devSimulateMpesaCallback() in featured-service.ts.
 * Hard-blocked server-side outside development regardless of what calls it. */
export async function devSimulatePaymentAction(
  paymentId: string,
  outcome: "success" | "failure"
): Promise<FeatureActionState> {
  try {
    await devSimulateMpesaCallback(paymentId, outcome);
    revalidatePath("/dashboard/featured");
    return { success: true };
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
}

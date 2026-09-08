"use server";

import { revalidatePath } from "next/cache";
import {
  createCoupon,
  updateCoupon,
  archiveCoupon,
  unarchiveCoupon,
  checkCoupon,
  CouponNotFoundError,
  CouponUsageLimitExceededError,
  DuplicateCouponCodeError,
  CouponNotFoundForAdminError,
} from "@/server/services/coupon-service";
import { requireAuth, AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { ZodError } from "zod";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof CouponNotFoundError) return error.message;
  if (error instanceof CouponUsageLimitExceededError) return error.message;
  if (error instanceof DuplicateCouponCodeError) return error.message;
  if (error instanceof CouponNotFoundForAdminError) return error.message;
  if (error instanceof ZodError) return error.errors[0]?.message ?? "Please check the form.";
  console.error("Unhandled error in coupon action:", error);
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Admin: CRUD
// ---------------------------------------------------------------------------

export type CouponFormState = { error?: string; success?: boolean };

function readCouponFormData(formData: FormData) {
  return {
    code: String(formData.get("code") ?? ""),
    discountPercent: String(formData.get("discountPercent") ?? ""),
    usageLimitPerUser: String(formData.get("usageLimitPerUser") ?? ""),
  };
}

export async function createCouponFormAction(
  _prevState: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  try {
    await createCoupon(readCouponFormData(formData));
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function updateCouponFormAction(
  couponId: string,
  _prevState: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  try {
    await updateCoupon(couponId, readCouponFormData(formData));
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${couponId}/edit`);
  return { success: true };
}

export async function archiveCouponAction(couponId: string): Promise<ActionResult<null>> {
  try {
    await archiveCoupon(couponId);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/coupons");
  return { success: true, data: null };
}

export async function unarchiveCouponAction(couponId: string): Promise<ActionResult<null>> {
  try {
    await unarchiveCoupon(couponId);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/coupons");
  return { success: true, data: null };
}

// ---------------------------------------------------------------------------
// Public: live "Apply coupon" preview (Featured Listings + Service orders
// only — see coupon-service.ts's module comment). Never records a
// redemption itself; that only happens inside the real checkout flow
// (startFeatureSubscription / initiateServiceOrder), which re-validates
// the code from scratch rather than trusting this preview's result.
// ---------------------------------------------------------------------------

export type CouponPreviewResult =
  | { valid: true; discountPercent: number; discountedAmount: number }
  | { valid: false; error: string };

/** For Featured Listings — always authenticated, so the usage-limit check
 * runs against the real signed-in seller from the start. */
export async function previewFeaturedCouponAction(
  code: string,
  amount: number
): Promise<CouponPreviewResult> {
  try {
    const user = await requireAuth();
    const result = await checkCoupon({ code, amount, userId: user.id });
    return { valid: true, discountPercent: result.discountPercent, discountedAmount: result.discountedAmount };
  } catch (error) {
    return { valid: false, error: toUserSafeError(error) };
  }
}

/** For Service orders — anonymous checkout, so the phone number (if the
 * customer has typed it in yet) is the only identity available for the
 * usage-limit check; without it, this still validates the code and
 * discount, just without that check (the real submission always re-checks
 * with the phone that's actually used). */
export async function previewServiceCouponAction(
  code: string,
  amount: number,
  customerPhone?: string
): Promise<CouponPreviewResult> {
  try {
    const result = await checkCoupon({
      code,
      amount,
      customerPhone: customerPhone?.trim() || undefined,
    });
    return { valid: true, discountPercent: result.discountPercent, discountedAmount: result.discountedAmount };
  } catch (error) {
    return { valid: false, error: toUserSafeError(error) };
  }
}

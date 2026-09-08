import { z } from "zod";

// Codes are always normalized to uppercase/trimmed before storage or
// lookup (see coupon-service.ts's resolveCoupon) — validated here in the
// same shape so an admin typing "save20" and a customer typing "SAVE20"
// both resolve to the identical row.
const couponCode = z
  .string()
  .trim()
  .min(3, "Code must be at least 3 characters")
  .max(30, "Code is too long")
  .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers, and hyphens");

// Same "raw form string in, validated number out" shape as moneyString in
// other validation modules (e.g. csr-schema.ts) — z.input on these stays a
// string, which is what a form action actually has in hand from FormData.
const wholeNumberString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, `Enter a whole number between ${min} and ${max}`);

export const createCouponSchema = z.object({
  code: couponCode,
  discountPercent: wholeNumberString(5, 100, "a discount percentage"),
  usageLimitPerUser: wholeNumberString(1, 1000, "a usage limit"),
});
export type CreateCouponInput = z.input<typeof createCouponSchema>;

export const updateCouponSchema = createCouponSchema;
export type UpdateCouponInput = z.input<typeof updateCouponSchema>;

// Used by both the live "Apply" preview and the actual checkout — a coupon
// is optional everywhere it appears, so the field itself is just a plain
// string; "no coupon" is represented by omitting/blanking it upstream, not
// by a special value here.
export const redeemCouponSchema = z.object({
  code: couponCode,
  amount: z.number().positive(),
});
export type RedeemCouponInput = z.input<typeof redeemCouponSchema>;

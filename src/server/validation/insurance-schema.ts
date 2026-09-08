import { z } from "zod";

const moneyString = z
  .string()
  .trim()
  .min(1, "Enter a starting price")
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v > 0, "Enter a valid price greater than 0");

export const createInsurancePolicySchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(5000),
  startingPrice: moneyString,
});
export type CreateInsurancePolicyInput = z.input<typeof createInsurancePolicySchema>;

export const updateInsurancePolicySchema = createInsurancePolicySchema;
export type UpdateInsurancePolicyInput = z.input<typeof updateInsurancePolicySchema>;

// A customer buys without an account (same "no login required" pattern as
// CSR donations and service orders) — customerPhone is required (the STK
// push needs a real number to push to); name/email are optional. Note
// there is deliberately no `amount` field here — the price is always taken
// server-side from the policy's own startingPrice (see
// initiateInsurancePurchase()), never from client input.
export const purchaseInsurancePolicySchema = z.object({
  policyId: z.string().min(1),
  customerPhone: z.string().trim().min(1, "Enter your M-Pesa phone number"),
  customerName: z.string().trim().max(150).optional(),
  customerEmail: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
});
export type PurchaseInsurancePolicyInput = z.input<typeof purchaseInsurancePolicySchema>;

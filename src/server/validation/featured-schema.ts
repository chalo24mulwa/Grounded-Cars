import { z } from "zod";

export const startFeatureSchema = z.object({
  listingId: z.string().min(1),
  planId: z.string().min(1),
  phoneNumber: z.string().min(9, "Enter a valid Safaricom number"),
  // Optional — a blank/omitted code means "no coupon," not an error. See
  // startFeatureSubscription() in featured-service.ts for how it's applied.
  couponCode: z.string().trim().optional(),
});

export type StartFeatureInput = z.infer<typeof startFeatureSchema>;

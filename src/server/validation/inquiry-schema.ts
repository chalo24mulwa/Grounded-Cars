import { z } from "zod";

export const createInquirySchema = z.object({
  listingId: z.string().min(1),
  // Length bounds are the input-length-limit part of spam/abuse protection
  // the spec asks for — too short to be a real question, too long to be a
  // reasonable inquiry message (and cheap insurance against someone pasting
  // megabytes of text into a Text column).
  message: z
    .string()
    .trim()
    .min(10, "Please include a few more details in your message.")
    .max(2000, "Message is too long — please keep it under 2000 characters."),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

export const INQUIRY_STATUSES = ["NEW", "READ", "REPLIED", "CLOSED"] as const;

export const updateInquiryStatusSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
});

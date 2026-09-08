import { z } from "zod";

// Same z.input/z.infer convention as event-schema.ts: these schemas
// transform raw form strings (dates, numbers) into their real types, so
// callers building the argument object from FormData must use z.input (the
// pre-transform shape), not z.infer (the post-transform shape) — using the
// wrong one is the exact "Date vs string" mismatch documented there.

const moneyString = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v > 0, "Enter a valid amount greater than 0");

const dateString = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date");

export const createCsrInitiativeSchema = z
  .object({
    title: z.string().trim().min(5, "Title must be at least 5 characters").max(150),
    summary: z.string().trim().min(10, "Summary must be at least 10 characters").max(300),
    story: z.string().trim().min(20, "Story must be at least 20 characters").max(10000),
    targetAmount: moneyString,
    startDate: dateString,
    endDate: dateString,
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type CreateCsrInitiativeInput = z.input<typeof createCsrInitiativeSchema>;

export const updateCsrInitiativeSchema = createCsrInitiativeSchema;
export type UpdateCsrInitiativeInput = z.input<typeof updateCsrInitiativeSchema>;

// A visitor donates without an account — donorPhone is required (the STK
// push has to land on a real number); donorName/donorEmail are optional
// ("where appropriate" per the spec).
export const donateToCsrInitiativeSchema = z.object({
  initiativeId: z.string().min(1),
  amount: z
    .number()
    .refine((v) => Number.isFinite(v), "Enter a valid amount")
    .refine((v) => v >= 10, "Minimum donation is KES 10")
    .refine((v) => v <= 1_000_000, "Maximum donation is KES 1,000,000 per transaction"),
  donorPhone: z.string().trim().min(1, "Enter your M-Pesa phone number"),
  donorName: z.string().trim().max(150).optional(),
  donorEmail: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
});
export type DonateToCsrInitiativeInput = z.input<typeof donateToCsrInitiativeSchema>;

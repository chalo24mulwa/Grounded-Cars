import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(150),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(5000),
  location: z.string().trim().max(150).optional(),
  // Submitted as a plain "YYYY-MM-DD" (or datetime-local) string from the
  // form — parsed to a Date here, the one place that needs to know that.
  eventDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Enter a valid date"),
});

// The schema transforms `eventDate` from a raw form string into a Date —
// z.infer gives the POST-transform (output) shape, which is what service
// functions work with internally; z.input gives the PRE-transform (raw)
// shape actually passed in from a form/action, which is what a caller
// building the argument object needs. Using the wrong one here is exactly
// the "Date vs string" mismatch that bit this the first time it was written.
export type CreateEventInput = z.input<typeof createEventSchema>;

export const updateEventSchema = createEventSchema;
export type UpdateEventInput = z.input<typeof updateEventSchema>;

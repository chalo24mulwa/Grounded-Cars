import { z } from "zod";
import { combineEventDateTime } from "@/lib/event-utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (y < 2000 || y > 2100) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const createEventSchema = z
  .object({
    title: z.string().trim().min(5, "Title must be at least 5 characters").max(150),
    description: z.string().trim().min(10, "Description must be at least 10 characters").max(5000),
    location: z.string().trim().max(150).optional(),
    // "YYYY-MM-DD" from the form's date input.
    eventDate: z.string().trim().optional(),
    // "HH:mm" from the form's time input, East Africa Time. Optional, and only
    // meaningful together with a date.
    eventTime: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.eventDate && !isRealDate(value.eventDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eventDate"], message: "Enter a valid date" });
    }
    if (value.eventTime && !TIME_PATTERN.test(value.eventTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eventTime"], message: "Enter a valid time" });
    }
    if (value.eventTime && !value.eventDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eventTime"], message: "Choose an event date to go with the time" });
    }
  })
  // The date and time fields collapse into the one stored value (see
  // lib/event-utils.ts for how a time fits in the existing date column).
  .transform(({ eventDate, eventTime, ...rest }) => ({
    ...rest,
    eventDate: eventDate ? combineEventDateTime(eventDate, eventTime || undefined) : undefined,
  }));

// z.infer gives the POST-transform (output) shape the service works with;
// z.input gives the raw shape a form/action actually passes in, which is what
// a caller building the argument object needs.
export type CreateEventInput = z.input<typeof createEventSchema>;

export const updateEventSchema = createEventSchema;
export type UpdateEventInput = z.input<typeof updateEventSchema>;

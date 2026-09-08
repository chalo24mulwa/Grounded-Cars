import { z } from "zod";

// Admin-only account creation — there is no public/self-service path to the
// MODERATOR role anywhere in the app (see registerUser() in
// auth-service.ts, which is hardcoded to BUYER). Shape mirrors
// registerUserSchema, except phone stays optional here: this is an
// admin-created account, not a public registration, so the mandatory-phone
// business rule for new signups doesn't apply.
export const createModeratorSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number is too long")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type CreateModeratorInput = z.input<typeof createModeratorSchema>;

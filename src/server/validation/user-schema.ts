import { z } from "zod";

// Deliberately has NO `role` field. Role is never accepted from client
// input anywhere in the app — it's fixed to BUYER at creation (see the
// Prisma schema default and the registration service), and can only be
// changed later through an explicit, authorized action: becomeSeller() in
// auth-service.ts (BUYER → SELLER only, self-service) or a future admin
// action. There is no signup-time "account type" selector because Phase 1's
// architecture deliberately keeps registration and role-upgrade separate —
// see docs/architecture.md.
export const registerUserSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
  // Mandatory at registration (business requirement) — a missing, empty, or
  // whitespace-only value is rejected here before it ever reaches
  // registerUser()/Prisma. Deliberately NOT mirrored as a NOT NULL
  // constraint on User.phone in schema.prisma: that column also backs
  // existing rows created before this rule (including any future OAuth
  // signup path, which wouldn't collect a phone number at all) — enforcing
  // it at this validation boundary is what makes it strictly required for
  // new registrations without forcing a backfill of unrelated existing
  // users. updateProfileSchema's `phone` intentionally stays optional — the
  // profile-edit flow is unaffected by this rule.
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20, "Phone number is too long"),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

// Client-facing superset of registerUserSchema — adds the confirm-password
// UX check. registerUser() (auth-service.ts) still only accepts the base
// shape, so a stray `confirmPassword` value never reaches the database.
export const registerFormSchema = registerUserSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormInput = z.infer<typeof registerFormSchema>;

// Intentionally lenient (no min-length) — the login form should never tell
// an attacker *why* a credential was rejected, including via a stricter
// password-shape check that a valid-but-wrong-password wouldn't trigger.
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  phone: z.string().max(20).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset link is missing its token"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

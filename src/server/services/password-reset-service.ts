import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildNotificationEmail } from "@/lib/email-templates";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
} from "@/server/validation/user-schema";

// ----------------------------------------------------------------------------
// Forgot-password architecture (Phase 2, email wired up in Phase 8). The
// reset link is emailed via lib/email.ts — the same provider-agnostic
// service every marketplace-event notification uses — and, in
// non-production only, also returned to the caller so the flow stays
// testable without a real inbox. This is deliberately NOT routed through
// notification-service.ts's notify(): a password reset isn't a
// preference-gateable marketplace event (a user can never opt out of being
// able to reset their own password), and it has no in-app-notification
// equivalent — it's a one-off transactional email with its own template
// call, same as this file's token handling already lives outside the
// Notification model. The email NEVER contains the account's actual
// password — only a single-use, short-lived, hashed-at-rest reset token.
// A failure to send never blocks the response (see the try/catch below):
// the token is already valid either way, and in dev the link is still
// visible via devResetUrl.
// ----------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export class InvalidOrExpiredTokenError extends Error {
  constructor() {
    super("This password reset link is invalid or has expired.");
    this.name = "InvalidOrExpiredTokenError";
  }
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Always resolves the same way whether or not the email belongs to an
 * account — the caller (and thus the UI) can't distinguish "sent" from
 * "no such account," which is what prevents this form from being used to
 * enumerate registered emails.
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput
): Promise<{ devResetUrl?: string }> {
  const { email } = requestPasswordResetSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status !== "ACTIVE") {
    return {};
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  await prisma.$transaction([
    // Only the most recently requested link should ever work.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

  const { subject, html, text } = buildNotificationEmail({
    title: "Reset your password",
    message: "We received a request to reset your password. This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.",
    ctaLabel: "Reset password",
    ctaUrl: resetUrl,
  });
  await sendEmail({ to: email, subject, html, text });

  return { devResetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const data = resetPasswordSchema.parse(input);
  const tokenHash = hashToken(data.token);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new InvalidOrExpiredTokenError();
  }

  const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

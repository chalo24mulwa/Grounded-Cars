"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn, signOut, updateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerUser, EmailAlreadyRegisteredError } from "@/server/services/auth-service";
import { updateProfile, changePassword, becomeSeller, InvalidCurrentPasswordError } from "@/server/services/auth-service";
import {
  requestPasswordReset,
  resetPassword,
  InvalidOrExpiredTokenError,
} from "@/server/services/password-reset-service";
import { checkRateLimit, RateLimitError } from "@/server/services/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { roleDestination, safeCallbackUrl } from "@/lib/role-destination";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import {
  registerFormSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/server/validation/user-schema";

// ----------------------------------------------------------------------------
// Thin server actions, same shape as listing-actions.ts: parse formData,
// delegate to a service, translate known errors into a safe message, never
// leak internals. These return AuthActionState so they can be bound
// directly to useActionState() in the client form components.
// ----------------------------------------------------------------------------

export type AuthActionState = {
  error?: string;
  success?: boolean;
  devResetUrl?: string;
};

function unexpectedError(context: string, error: unknown): AuthActionState {
  console.error(`Unhandled error in ${context}:`, error);
  return { error: "Something went wrong. Please try again, or contact support if this continues." };
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const ip = await getClientIp();
  try {
    checkRateLimit(`register:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }

  const parsed = registerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    // No `|| undefined` fallback here (unlike updateProfileAction's still-
    // optional phone below) — phone is now required, so an empty submission
    // must reach registerUserSchema's own validator and produce its
    // "Enter a valid phone number" message, not silently become undefined.
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Please check the form and try again." };
  }

  try {
    await registerUser(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) return { error: error.message };
    return unexpectedError("registration", error);
  }

  const callbackUrl = safeCallbackUrl(String(formData.get("callbackUrl") ?? ""));

  try {
    // Auto sign-in right after successful registration — role is always
    // BUYER at this point (registerUser never accepts an override). Absent
    // a callbackUrl (e.g. arriving via the "Sell a Car" flow), the
    // destination is fixed at /account, unlike loginAction's role lookup.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl ?? "/account",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Registration itself succeeded even if this auto-login step didn't —
      // send them to log in manually instead of surfacing an error, keeping
      // whatever callbackUrl they arrived with.
      redirect(callbackUrl ? `/login?registered=1&callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login?registered=1");
    }
    throw error; // includes NEXT_REDIRECT on success — must propagate
  }

  return {};
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = await getClientIp();

  try {
    checkRateLimit(`login:${ip}:${email}`, { max: 8, windowMs: 15 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }

  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  // Looked up only to choose a role-appropriate landing page. The password
  // itself is verified exclusively inside the Credentials provider's
  // authorize() function (src/lib/auth.ts) — this lookup never substitutes
  // for that check, and a wrong password below still fails regardless of
  // what this returned.
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true },
  });
  const callbackUrl = safeCallbackUrl(String(formData.get("callbackUrl") ?? ""));
  const destination = callbackUrl ?? roleDestination(existingUser?.role ?? "BUYER");

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: destination });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error; // includes NEXT_REDIRECT on success — must propagate
  }

  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/**
 * Kicks off the Google OAuth redirect. Unlike registerAction/loginAction,
 * there's no credential to validate up front here — this always redirects
 * to Google's consent screen (signIn() throws NEXT_REDIRECT internally, the
 * same mechanism every other redirecting action in this file relies on).
 * Whether the round trip ends in a new account, a login to an existing
 * linked account, or a safe link to an existing same-email account is
 * decided entirely by the adapter + the signIn callback in lib/auth.ts —
 * this action only ever initiates the flow.
 */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const callbackUrl = safeCallbackUrl(String(formData.get("callbackUrl") ?? ""));
  await signIn("google", { redirectTo: callbackUrl ?? "/account" });
}

export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = await getClientIp();

  try {
    checkRateLimit(`reset-request:${ip}:${email}`, { max: 5, windowMs: 15 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }

  const parsed = requestPasswordResetSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  try {
    const { devResetUrl } = await requestPasswordReset(parsed.data);
    return { success: true, devResetUrl };
  } catch (error) {
    return unexpectedError("password reset request", error);
  }
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Please check the form and try again." };
  }

  try {
    await resetPassword(parsed.data);
  } catch (error) {
    if (error instanceof InvalidOrExpiredTokenError) return { error: error.message };
    return unexpectedError("password reset", error);
  }

  redirect("/login?reset=1");
}

export async function updateProfileAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Please check the form and try again." };
  }

  try {
    await updateProfile(parsed.data);
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Please sign in and try again." };
    return unexpectedError("profile update", error);
  }

  revalidatePath("/account");
  return { success: true };
}

export async function changePasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Please check the form and try again." };
  }

  try {
    await changePassword(parsed.data);
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Please sign in and try again." };
    if (error instanceof InvalidCurrentPasswordError) return { error: error.message };
    return unexpectedError("password change", error);
  }

  return { success: true };
}

export async function becomeSellerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const updated = await becomeSeller();
    // Refresh the session JWT in place so the just-upgraded role is visible
    // to middleware immediately — otherwise the very next request to
    // /dashboard would be rejected by the still-BUYER token from sign-in.
    await updateSession({ user: { role: updated.role } });
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Please sign in and try again." };
    if (error instanceof AuthorizationError) return { error: error.message };
    return unexpectedError("become-seller", error);
  }

  revalidatePath("/account");
  const redirectTo = safeCallbackUrl(String(formData.get("redirectTo") ?? ""));
  redirect(redirectTo ?? "/dashboard");
}

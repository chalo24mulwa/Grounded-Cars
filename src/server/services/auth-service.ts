import "server-only";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  registerUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  type RegisterUserInput,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from "@/server/validation/user-schema";
import { requireAuth, AuthorizationError } from "@/server/authorization/ownership";

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super("Your current password is incorrect.");
    this.name = "InvalidCurrentPasswordError";
  }
}

/**
 * Registers a new buyer account. This is the ONLY entry point for account
 * creation. Role is always BUYER — there is intentionally no parameter to
 * override it. Sellers are upgraded via a separate, explicit action later
 * (e.g. "Become a seller" flow in Phase 3), and admins are only ever
 * created directly in the database or via an authenticated admin action —
 * never through public registration.
 */
export async function registerUser(input: RegisterUserInput) {
  const data = registerUserSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: "BUYER",
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return user;
}

/** Fetches the full profile of the currently signed-in user for the
 * account page — the session JWT only carries id/role/name/email, not
 * phone/status/createdAt. */
export async function getCurrentUserProfile() {
  const currentUser = await requireAuth();
  return prisma.user.findUniqueOrThrow({
    where: { id: currentUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
}

/** Updates the current user's own permitted profile fields. Email is not
 * editable here — changing it would require re-verification, which is out
 * of scope for this phase; see docs/architecture.md's Phase roadmap. */
export async function updateProfile(input: UpdateProfileInput) {
  const currentUser = await requireAuth();
  const data = updateProfileSchema.parse(input);

  return prisma.user.update({
    where: { id: currentUser.id },
    data: { name: data.name, phone: data.phone },
    select: { id: true, name: true, email: true, phone: true, role: true, status: true },
  });
}

/** Changes the current user's own password. Requires the current password —
 * this is a self-service action, not an admin override. */
export async function changePassword(input: ChangePasswordInput) {
  const currentUser = await requireAuth();
  const data = changePasswordSchema.parse(input);

  const dbUser = await prisma.user.findUnique({ where: { id: currentUser.id } });
  if (!dbUser?.passwordHash) {
    throw new AuthorizationError("Password changes aren't available for this account.");
  }

  const { valid: currentPasswordValid } = await verifyPassword(data.currentPassword, dbUser.passwordHash);
  if (!currentPasswordValid) {
    throw new InvalidCurrentPasswordError();
  }

  const passwordHash = await hashPassword(data.newPassword);
  await prisma.user.update({ where: { id: currentUser.id }, data: { passwordHash } });
}

/**
 * Self-service BUYER → SELLER upgrade. Deliberately the ONLY path to the
 * SELLER role outside direct database/admin action — registration always
 * creates BUYER (see registerUser above), and this function only ever moves
 * BUYER → SELLER, never anything → ADMIN. Recorded in AuditLog so the
 * upgrade is traceable if seller-approval requirements are added later
 * (Phase 7) without needing a schema change to retrofit that history.
 */
export async function becomeSeller() {
  const currentUser = await requireAuth();

  if (currentUser.role !== "BUYER") {
    throw new AuthorizationError("Only buyer accounts can become a seller.");
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: currentUser.id },
      data: { role: "SELLER" },
      select: { id: true, role: true },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: currentUser.id,
        action: "ROLE_UPGRADED_TO_SELLER",
        entityType: "User",
        entityId: currentUser.id,
      },
    }),
  ]);

  return updated;
}

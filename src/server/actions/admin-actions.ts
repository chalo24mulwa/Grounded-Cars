"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  approveListing,
  rejectListing,
  archiveListingByAdmin,
  deleteListingPermanently,
} from "@/server/services/listing-service";
import { createFeaturedPlan, setFeaturedPlanActive } from "@/server/services/featured-service";
import {
  setUserStatus,
  startImpersonation,
  endImpersonation,
  createModeratorAccount,
  deleteModeratorAccount,
  DuplicateModeratorEmailError,
  ModeratorNotFoundError,
  ModeratorHasActivityError,
} from "@/server/services/admin-service";
import { recordAuditLog } from "@/server/services/audit-service";
import { requireRole, AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { InvalidStatusTransitionError } from "@/server/services/listing-status";
import { updateSession } from "@/lib/auth";
import { roleDestination } from "@/lib/role-destination";
import { ZodError, z } from "zod";
import type { UserStatus } from "@prisma/client";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof InvalidStatusTransitionError) return error.message;
  if (error instanceof DuplicateModeratorEmailError) return error.message;
  if (error instanceof ModeratorNotFoundError) return error.message;
  if (error instanceof ModeratorHasActivityError) return error.message;
  if (error instanceof ZodError) return error.errors[0]?.message ?? "Please check the form.";
  console.error("Unhandled error in admin action:", error);
  return "Something went wrong. Please try again.";
}

// For actions whose real work (a listing's status change) has already been
// committed by the time the audit entry is written. If the audit write then
// fails, reporting the whole action as failed is wrong — the listing IS
// approved/sent back/archived, so the admin sees "Something went wrong",
// retries, and hits a confusing invalid-transition error instead. Log it and
// let the action report the success it actually achieved.
async function recordAuditLogAfterCommit(...args: Parameters<typeof recordAuditLog>) {
  try {
    await recordAuditLog(...args);
  } catch (error) {
    console.error("Audit log write failed after the action itself had already committed:", error);
  }
}

const createPlanSchema = z.object({
  name: z.string().min(2).max(60),
  durationDays: z.coerce.number().int().min(1).max(365),
  price: z.coerce.number().positive().max(1_000_000),
  currency: z.string().length(3).default("KES"),
});

export type PlanActionState = { error?: string; success?: boolean };

export async function createFeaturedPlanAction(
  _prevState: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  let planId: string | undefined;
  try {
    const data = createPlanSchema.parse({
      name: formData.get("name"),
      durationDays: formData.get("durationDays"),
      price: formData.get("price"),
      currency: formData.get("currency") || "KES",
    });
    const admin = await requireRole("ADMIN");
    const plan = await createFeaturedPlan(data);
    planId = plan.id;
    await recordAuditLog(admin.id, "FEATURED_PLAN_CREATED", "FeaturedPlan", plan.id, {
      name: data.name,
      durationDays: data.durationDays,
      price: data.price,
    });
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/plans");
  return { success: true };
}

export async function setFeaturedPlanActiveAction(
  planId: string,
  active: boolean
): Promise<ActionResult<null>> {
  try {
    const admin = await requireRole("ADMIN");
    await setFeaturedPlanActive(planId, active);
    await recordAuditLog(admin.id, "FEATURED_PLAN_STATUS_CHANGED", "FeaturedPlan", planId, {
      active,
    });
    revalidatePath("/admin/plans");
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

// approveListing()/rejectListing()/archiveListingByAdmin() (listing-service.ts)
// all go through changeListingStatus() → assertValidTransition(), which is
// what actually enforces role restrictions — this action layer's own job is
// just parsing input and writing the audit trail, never authorization.

// Speed: the approval used to wait, one after another, for the role check,
// the approval, the audit entry and then a full re-render of the admin page
// before the button showed anything — 4s with a nearby database, far longer
// with the live one. Now the role check runs alongside the approval
// (approveListing re-checks the role itself, so nothing is skipped), the
// audit entry is written in the background (still always written), and the
// page refreshes in the background after the button shows success (see
// PendingListingRow). No revalidatePath here: it made this response wait for
// the admin page to be rebuilt, and every page involved is rendered fresh on
// each visit anyway (public listings caches are cleared by the write itself).
export async function approveListingAction(listingId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const [admin, listing] = await Promise.all([requireRole("ADMIN", "MODERATOR"), approveListing(listingId)]);
    void recordAuditLogAfterCommit(admin.id, "LISTING_APPROVED", "CarListing", listing.id, {
      title: listing.title,
    });
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Please explain what needs to change (at least 10 characters).")
    .max(1000),
});

export async function rejectListingAction(
  listingId: string,
  reason: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const { reason: validReason } = rejectSchema.parse({ reason });
    const admin = await requireRole("ADMIN", "MODERATOR");
    const listing = await rejectListing(listingId, validReason);
    await recordAuditLogAfterCommit(admin.id, "LISTING_REJECTED", "CarListing", listing.id, {
      title: listing.title,
      reason: validReason,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/listings");
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function archiveListingByAdminAction(
  listingId: string,
  reason: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const { reason: validReason } = rejectSchema.parse({ reason });
    const admin = await requireRole("ADMIN");
    const listing = await archiveListingByAdmin(listingId, validReason);
    await recordAuditLogAfterCommit(admin.id, "LISTING_ARCHIVED_BY_ADMIN", "CarListing", listing.id, {
      title: listing.title,
      reason: validReason,
    });
    revalidatePath("/admin/listings");
    revalidatePath("/cars");
    return { success: true, data: { id: listing.id } };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

// Permanent, irreversible delete of any listing (any seller, any status) plus
// all of its stored photos/files. ADMIN only — deliberately not MODERATOR,
// who can review/approve/send back but never destroy. No reason is taken; the
// audit entry records who deleted what (title, seller, how many files were
// erased) so the action itself stays accountable even though the listing
// doesn't survive.
export async function deleteListingPermanentlyAction(listingId: string): Promise<ActionResult<null>> {
  try {
    const admin = await requireRole("ADMIN");
    const deleted = await deleteListingPermanently(listingId);
    await recordAuditLogAfterCommit(admin.id, "LISTING_DELETED_BY_ADMIN", "CarListing", deleted.id, {
      title: deleted.title,
      sellerId: deleted.sellerId,
      filesRemoved: deleted.filesRemoved,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/listings");
    revalidatePath("/dashboard/listings");
    revalidatePath("/cars");
    revalidatePath("/");
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export async function setUserStatusAction(
  userId: string,
  status: UserStatus,
  reason?: string
): Promise<ActionResult<null>> {
  try {
    await setUserStatus(userId, status, reason);
    revalidatePath("/admin/users");
    // Also reused by the /admin/moderators list (see UserStatusControl) —
    // harmless no-op revalidate for callers on /admin/users.
    revalidatePath("/admin/moderators");
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export type ModeratorFormState = { error?: string; success?: boolean };

// No self-service or public registration path exists for this role — the
// (admin) layout already gates the whole /admin/moderators route to ADMIN,
// and createModeratorAccount() independently re-requires ADMIN too, so this
// is never reachable except from an authenticated admin action either way.
export async function createModeratorFormAction(
  _prevState: ModeratorFormState,
  formData: FormData
): Promise<ModeratorFormState> {
  try {
    await createModeratorAccount({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      phone: String(formData.get("phone") ?? "") || undefined,
    });
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/moderators");
  return { success: true };
}

export async function deleteModeratorAction(userId: string): Promise<ActionResult<null>> {
  try {
    await deleteModeratorAccount(userId);
    revalidatePath("/admin/moderators");
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
}

export type ImpersonationActionState = { error?: string };

// Redirects into the target user's own natural landing page (their account
// or seller dashboard) on success — there's no "success" state to return,
// same as loginAction/becomeSellerAction, since a thrown NEXT_REDIRECT
// short-circuits the rest of this function.
export async function startImpersonationAction(
  _prevState: ImpersonationActionState,
  formData: FormData
): Promise<ImpersonationActionState> {
  const targetUserId = String(formData.get("userId") ?? "");

  let admin: { id: string };
  let target: { id: string; name: string; email: string; role: "BUYER" | "SELLER" };
  try {
    const result = await startImpersonation(targetUserId);
    admin = result.admin;
    target = result.target as typeof target;
  } catch (error) {
    return { error: toUserSafeError(error) };
  }

  // Refresh the session JWT in place (see becomeSellerAction for the same
  // pattern) — this is the one place the actual identity swap happens;
  // startImpersonation() above only validated and audited it. name/email
  // ride along too so anything reading session.user.name (e.g. the
  // dashboard's "Welcome back, {name}") shows the user being acted as.
  await updateSession({
    user: { id: target.id, role: target.role, name: target.name, email: target.email },
    impersonatorId: admin.id,
  });
  redirect(roleDestination(target.role));
}

// No form state to report back — this is only ever reached from the
// always-visible ImpersonationBanner, which has nothing useful to do with
// an error besides the default error boundary (ending impersonation should
// essentially never fail; see endImpersonation()'s own doc comment).
export async function endImpersonationAction(): Promise<void> {
  const { admin } = await endImpersonation();
  await updateSession({
    user: { id: admin.id, role: admin.role, name: admin.name, email: admin.email },
    impersonatorId: null,
  });
  redirect("/admin/users");
}

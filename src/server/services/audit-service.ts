import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, retryOnTransientConnectionError } from "@/lib/prisma";
import { requireRole } from "@/server/authorization/ownership";

// ----------------------------------------------------------------------------
// Audit logging for privileged admin actions. The `AuditLog` table has
// existed since Phase 1 (append-only, never updated or deleted by
// application code — there is no updateLog/deleteLog function anywhere,
// deliberately). This phase is the first to actually write to it for admin
// actions specifically (becomeSeller() in auth-service.ts already writes a
// self-service ROLE_UPGRADED_TO_SELLER entry — this is the admin-facing
// counterpart).
//
// `metadata` must never contain a password, token, or other secret — every
// call site below only passes plain business facts (a reason string, an
// old/new status, a listing title) that are already visible to the actor
// performing the action.
// ----------------------------------------------------------------------------

export type AuditAction =
  | "LISTING_APPROVED"
  | "LISTING_REJECTED"
  | "LISTING_ARCHIVED_BY_ADMIN"
  | "LISTING_DELETED_BY_ADMIN"
  | "USER_STATUS_CHANGED"
  | "FEATURED_PLAN_CREATED"
  | "FEATURED_PLAN_STATUS_CHANGED"
  | "IMPERSONATION_START"
  | "IMPERSONATION_END"
  | "MODERATOR_CREATED"
  | "MODERATOR_DELETED"
  | "TRENDING_VIDEO_REMOVED"
  | "TRENDING_COMMENT_REMOVED"
  | "TRENDING_POSTING_SUSPENDED"
  | "TRENDING_POSTING_RESTORED";

export async function recordAuditLog(
  actorUserId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  const data = {
    actorUserId,
    action,
    entityType,
    entityId,
    metadata: metadata as Prisma.InputJsonValue | undefined,
  };

  // The global Prisma retry only covers reads (a write that fails mid-commit
  // could double-apply). This write is safe to retry on a dropped connection:
  // the worst case is one duplicate audit row, whereas failing here — which is
  // always AFTER the admin action it records has already been committed —
  // used to surface as "Something went wrong" for an action that had in fact
  // succeeded.
  return retryOnTransientConnectionError(() => prisma.auditLog.create({ data }), 3, "AuditLog.create");
}

/** Admin-only, most recent first. */
export async function getAuditLog({
  page = 1,
  pageSize = 30,
}: { page?: number; pageSize?: number } = {}) {
  await requireRole("ADMIN");

  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * pageSize;

  const [entries, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count(),
  ]);

  return {
    entries,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    page: safePage,
  };
}

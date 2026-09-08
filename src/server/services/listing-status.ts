import "server-only";
import type { ListingStatus, UserRole } from "@prisma/client";

// ----------------------------------------------------------------------------
// Single source of truth for which listing_status transitions are legal, and
// who is allowed to perform each one. Any code that wants to change a
// listing's status — a server action, an admin tool, a future cron job for
// subscription expiry — must go through `assertValidTransition` rather than
// writing `status: "SOLD"` directly. This is what makes it structurally hard
// for a UI bug to produce an invalid or unauthorized transition.
// ----------------------------------------------------------------------------

// Each edge lists exactly which roles may perform THAT specific (from, to)
// move — not just which roles may reach the target status in general. This
// matters because two edges can share a target status but need different
// rules: PENDING → ACTIVE is a first-time publish and requires ADMIN
// approval (Phase 3 policy decision), while SOLD → ACTIVE is a seller
// restoring their own previously-approved listing and does NOT need
// re-approval. Keying only by target status (the Phase 1/2 shape) couldn't
// express that distinction, so this table is edge-keyed instead — still the
// single place moderation rules live, per the original Phase 1 comment.
const TRANSITIONS: { from: ListingStatus; to: ListingStatus; roles: UserRole[] }[] = [
  { from: "DRAFT", to: "PENDING", roles: ["SELLER", "ADMIN", "MODERATOR"] }, // submit for review
  { from: "DRAFT", to: "ARCHIVED", roles: ["SELLER", "ADMIN", "MODERATOR"] },
  { from: "PENDING", to: "ACTIVE", roles: ["ADMIN", "MODERATOR"] }, // approve — on admin's behalf
  { from: "PENDING", to: "DRAFT", roles: ["SELLER", "ADMIN", "MODERATOR"] }, // withdraw / send back for edits
  { from: "PENDING", to: "ARCHIVED", roles: ["ADMIN"] }, // reject
  { from: "ACTIVE", to: "SOLD", roles: ["SELLER", "ADMIN"] },
  { from: "ACTIVE", to: "ARCHIVED", roles: ["SELLER", "ADMIN"] },
  { from: "SOLD", to: "ACTIVE", roles: ["SELLER", "ADMIN"] }, // restore — no re-approval
  { from: "ARCHIVED", to: "DRAFT", roles: ["SELLER", "ADMIN"] }, // resubmit through normal review
  { from: "ARCHIVED", to: "ACTIVE", roles: ["ADMIN"] }, // un-archiving is publishing — admin only
];

export class InvalidStatusTransitionError extends Error {
  constructor(from: ListingStatus, to: ListingStatus) {
    super(`Cannot transition listing from ${from} to ${to}.`);
    this.name = "InvalidStatusTransitionError";
  }
}

export function assertValidTransition(
  from: ListingStatus,
  to: ListingStatus,
  actingRole: UserRole
) {
  if (from === to) {
    // No-op transitions are allowed (idempotent) but callers should
    // generally avoid triggering them.
    return;
  }

  const transition = TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition || !transition.roles.includes(actingRole)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

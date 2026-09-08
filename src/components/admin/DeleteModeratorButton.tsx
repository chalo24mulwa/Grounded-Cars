"use client";

import { ConfirmActionButton } from "@/components/dashboard/ConfirmActionButton";
import { deleteModeratorAction } from "@/server/actions/admin-actions";

// Genuinely destructive (unlike everything else "delete"-shaped in this
// admin area, which is soft-delete/archive) — deleteModeratorAccount()
// itself refuses when the account has listings/inquiries/payments and
// returns a clear message instead, which surfaces here in the confirm
// dialog's own error slot; this button doesn't duplicate that check.
export function DeleteModeratorButton({ userId, name }: { userId: string; name: string }) {
  return (
    <ConfirmActionButton
      label="Delete"
      confirmTitle="Delete this moderator account?"
      confirmMessage={`This permanently deletes ${name}'s account. This can't be undone — if they have any listings or activity, deletion will be refused; deactivate the account instead in that case.`}
      confirmLabel="Delete permanently"
      variant="danger"
      onAction={() => deleteModeratorAction(userId)}
    />
  );
}

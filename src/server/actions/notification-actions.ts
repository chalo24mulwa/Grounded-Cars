"use server";

import { revalidatePath } from "next/cache";
import {
  markNotificationRead,
  updateMyNotificationPreference,
} from "@/server/services/notification-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";

// Thin wrappers only — no business logic here, same convention as every
// other *-actions.ts file. No UI consumes these yet (no notification bell
// or preferences page has been built — see README's Known Limitations);
// they exist now so the service layer's access-control guarantees
// (markNotificationRead re-verifies ownership; updateMyNotificationPreference
// never accepts a userId) are already wired end-to-end for whenever that UI
// is built, with zero changes needed here.

type ActionResult = { success: true } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  console.error("Unhandled error in notification action:", error);
  return "Something went wrong. Please try again.";
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  try {
    await markNotificationRead(notificationId);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/account");
  return { success: true };
}

export async function updateNotificationPreferenceAction(input: {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
}): Promise<ActionResult> {
  try {
    await updateMyNotificationPreference(input);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/account");
  return { success: true };
}

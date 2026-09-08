"use server";

import { revalidatePath } from "next/cache";
import { addFavorite, removeFavorite } from "@/server/services/favorite-service";
import { AuthenticationError } from "@/server/authorization/ownership";

type ActionResult = { success: true } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in to save vehicles.";
  console.error("Unhandled error in favorite action:", error);
  return "Something went wrong. Please try again.";
}

export async function addFavoriteAction(listingId: string): Promise<ActionResult> {
  try {
    await addFavorite(listingId);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/favorites");
  return { success: true };
}

export async function removeFavoriteAction(listingId: string): Promise<ActionResult> {
  try {
    await removeFavorite(listingId);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/favorites");
  return { success: true };
}

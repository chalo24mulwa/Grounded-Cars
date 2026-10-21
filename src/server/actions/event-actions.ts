"use server";

import { revalidatePath } from "next/cache";
import {
  createEvent,
  updateEvent,
  setEventPublished,
  InvalidImageError,
} from "@/server/services/event-service";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { ZodError } from "zod";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function toUserSafeError(error: unknown): string {
  if (error instanceof AuthenticationError) return "Please sign in and try again.";
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof InvalidImageError) return error.message;
  if (error instanceof ZodError) return error.errors[0]?.message ?? "Please check the form.";
  console.error("Unhandled error in event action:", error);
  return "Something went wrong. Please try again.";
}

export type EventFormState = { error?: string; success?: boolean };

function readEventFormData(formData: FormData) {
  const str = (key: string) => {
    const v = formData.get(key);
    return v === null || v === "" ? undefined : String(v);
  };
  return {
    title: str("title") ?? "",
    description: str("description") ?? "",
    location: str("location"),
    eventDate: str("eventDate"),
    eventTime: str("eventTime"),
  };
}

export async function createEventFormAction(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const file = formData.get("image");
  try {
    await createEvent(readEventFormData(formData), file instanceof File ? file : null);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { success: true };
}

export async function updateEventFormAction(
  eventId: string,
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const file = formData.get("image");
  try {
    await updateEvent(eventId, readEventFormData(formData), file instanceof File ? file : null);
  } catch (error) {
    return { error: toUserSafeError(error) };
  }
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}/edit`);
  revalidatePath("/events");
  return { success: true };
}

export async function setEventPublishedAction(
  eventId: string,
  published: boolean
): Promise<ActionResult<null>> {
  try {
    await setEventPublished(eventId, published);
  } catch (error) {
    return { success: false, error: toUserSafeError(error) };
  }
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { success: true, data: null };
}

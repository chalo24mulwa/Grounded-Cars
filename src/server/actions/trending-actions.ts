"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { RateLimitError } from "@/server/services/rate-limit";
import { InvalidImageError } from "@/lib/storage";
import { TrendingError, updateMyProfile, setMyAvatar, removeMyAvatar, setBlocked } from "@/server/services/trending/profile-service";
import {
  createVideoUpload,
  getMyVideoStatus,
  listFeed,
  updateMyVideo,
  deleteMyVideo,
  recordShare,
  recordView,
} from "@/server/services/trending/video-service";
import {
  setVideoLike,
  listComments,
  addComment,
  editComment,
  deleteComment,
  setCommentLike,
} from "@/server/services/trending/interaction-service";
import {
  openConversationWith,
  sendMessage,
  getConversation,
  listMyConversations,
} from "@/server/services/trending/message-service";
import {
  createReport,
  setReportStatus,
  adminRemoveVideo,
  adminDeleteComment,
  adminSetPostingSuspended,
} from "@/server/services/trending/moderation-service";
import { runTrendingCleanup } from "@/server/services/trending/cleanup-service";
import { requireRole } from "@/server/authorization/ownership";

// Thin wrappers: each validates nothing itself beyond shapes — every rule
// (ownership, blocking, limits) lives in the services, which re-read the
// session on the server. Errors come back as short, safe messages.

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; needsLogin?: boolean };

function safeError(error: unknown): { ok: false; error: string; needsLogin?: boolean } {
  if (error instanceof AuthenticationError) return { ok: false, error: "Please log in first.", needsLogin: true };
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  if (error instanceof TrendingError || error instanceof RateLimitError || error instanceof InvalidImageError) {
    return { ok: false, error: error.message };
  }
  console.error("Unhandled error in trending action:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return safeError(error);
  }
}

const str = (value: unknown, max = 5000) => (typeof value === "string" ? value.slice(0, max) : "");

// --- Feed --------------------------------------------------------------------

export async function loadFeedPageAction(cursor: string | null) {
  return run(() => listFeed(typeof cursor === "string" ? cursor : null));
}

export async function recordViewAction(videoId: string) {
  await recordView(str(videoId, 40));
}

export async function recordShareAction(videoId: string) {
  await recordShare(str(videoId, 40));
}

// --- Upload ------------------------------------------------------------------

export async function createUploadAction(formData: FormData) {
  return run(async () => {
    const h = await headers();
    const origin = h.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "*";
    const num = (key: string) => {
      const raw = str(formData.get(key), 20).replace(/[,\s]/g, "");
      return raw ? Number(raw) : null;
    };
    const cover = formData.get("cover");
    return createVideoUpload(
      {
        title: str(formData.get("title"), 200),
        caption: str(formData.get("caption"), 3000),
        make: str(formData.get("make"), 80),
        model: str(formData.get("model"), 80),
        year: num("year"),
        price: num("price"),
        location: str(formData.get("location"), 120),
        listingId: str(formData.get("listingId"), 40) || null,
        durationSeconds: Number(formData.get("durationSeconds")),
        fileSize: Number(formData.get("fileSize")),
      },
      cover instanceof File ? cover : null,
      origin
    );
  });
}

export async function videoStatusAction(videoId: string) {
  return run(() => getMyVideoStatus(str(videoId, 40)));
}

export async function updateVideoAction(videoId: string, caption: string, title: string) {
  const result = await run(() => updateMyVideo(str(videoId, 40), { caption: str(caption, 3000), title: str(title, 200) }));
  if (result.ok) revalidatePath("/trending");
  return result;
}

export async function deleteVideoAction(videoId: string) {
  const result = await run(() => deleteMyVideo(str(videoId, 40)));
  if (result.ok) revalidatePath("/trending");
  return result;
}

// --- Likes & comments ----------------------------------------------------------

export async function setVideoLikeAction(videoId: string, like: boolean) {
  return run(() => setVideoLike(str(videoId, 40), Boolean(like)));
}

export async function listCommentsAction(videoId: string, parentId: string | null, cursor: string | null) {
  return run(() => listComments(str(videoId, 40), { parentId: parentId ? str(parentId, 40) : null, cursor: cursor ? str(cursor, 40) : null }));
}

export async function addCommentAction(videoId: string, body: string, parentId: string | null) {
  return run(() => addComment(str(videoId, 40), str(body, 2000), parentId ? str(parentId, 40) : null));
}

export async function editCommentAction(commentId: string, body: string) {
  return run(() => editComment(str(commentId, 40), str(body, 2000)));
}

export async function deleteCommentAction(commentId: string) {
  return run(() => deleteComment(str(commentId, 40)));
}

export async function setCommentLikeAction(commentId: string, like: boolean) {
  return run(() => setCommentLike(str(commentId, 40), Boolean(like)));
}

// --- Profile -----------------------------------------------------------------

export type ProfileFormState = { error?: string; success?: boolean };

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const result = await run(() =>
    updateMyProfile({
      username: str(formData.get("username"), 40),
      displayName: str(formData.get("displayName"), 80),
      bio: str(formData.get("bio"), 400),
    })
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/trending", "layout");
  return { success: true };
}

export async function setAvatarAction(formData: FormData) {
  const file = formData.get("avatar");
  const result = await run(async () => {
    if (!(file instanceof File) || file.size === 0) throw new TrendingError("Choose a picture first.");
    return setMyAvatar(file);
  });
  if (result.ok) revalidatePath("/trending", "layout");
  return result;
}

export async function removeAvatarAction() {
  const result = await run(() => removeMyAvatar());
  if (result.ok) revalidatePath("/trending", "layout");
  return result;
}

export async function setBlockedAction(profileId: string, blocked: boolean) {
  const result = await run(() => setBlocked(str(profileId, 40), Boolean(blocked)));
  if (result.ok) revalidatePath("/trending", "layout");
  return result;
}

// --- Messages ----------------------------------------------------------------

/** "Message" button: opens (or creates) the conversation and goes there. */
export async function messageProfileAction(profileId: string, videoId?: string | null) {
  const result = await run(() => openConversationWith(str(profileId, 40)));
  if (!result.ok) return result;
  redirect(`/trending/messages/${result.data}${videoId ? `?video=${encodeURIComponent(str(videoId, 40))}` : ""}`);
}

export async function sendMessageAction(conversationId: string, body: string, videoRefId: string | null) {
  return run(() => sendMessage(str(conversationId, 40), str(body, 2000), videoRefId ? str(videoRefId, 40) : null));
}

export async function pollConversationAction(conversationId: string, afterCreatedAt: string | null) {
  return run(() => getConversation(str(conversationId, 40), afterCreatedAt ? str(afterCreatedAt, 40) : null));
}

export async function listConversationsAction() {
  return run(() => listMyConversations());
}

// --- Reports & moderation ----------------------------------------------------------

export async function reportAction(targetType: "VIDEO" | "COMMENT" | "PROFILE", targetId: string, reason: string, details: string) {
  if (!["VIDEO", "COMMENT", "PROFILE"].includes(targetType)) return { ok: false as const, error: "Invalid report." };
  return run(() => createReport(targetType, str(targetId, 40), str(reason, 100), str(details, 600)));
}

export async function adminReportAction(
  kind: "resolve" | "dismiss" | "removeVideo" | "deleteComment" | "suspendPosting" | "restorePosting",
  id: string,
  reportId?: string
) {
  const result = await run(async () => {
    const target = str(id, 40);
    if (kind === "resolve") await setReportStatus(target, "RESOLVED");
    else if (kind === "dismiss") await setReportStatus(target, "DISMISSED");
    else if (kind === "removeVideo") await adminRemoveVideo(target);
    else if (kind === "deleteComment") await adminDeleteComment(target);
    else if (kind === "suspendPosting") await adminSetPostingSuspended(target, true);
    else if (kind === "restorePosting") await adminSetPostingSuspended(target, false);
    if (reportId && kind !== "resolve" && kind !== "dismiss") await setReportStatus(str(reportId, 40), "RESOLVED");
  });
  revalidatePath("/admin/trending");
  return result;
}

export async function runCleanupNowAction() {
  const result = await run(async () => {
    await requireRole("ADMIN");
    return runTrendingCleanup();
  });
  revalidatePath("/admin/trending");
  return result;
}

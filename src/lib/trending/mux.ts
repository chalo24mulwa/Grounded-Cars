import "server-only";
import crypto from "node:crypto";

// Minimal Mux Video REST client — just the calls Trending needs, via fetch,
// so no SDK is added to the server bundle. Credentials come only from
// environment variables (MUX_TOKEN_ID / MUX_TOKEN_SECRET / MUX_WEBHOOK_SECRET).
//
// Videos never pass through this server: the browser uploads straight to the
// one-time URL from createDirectUpload(), and Mux does all resizing.

const API_BASE = (process.env.MUX_API_BASE || "https://api.mux.com").replace(/\/+$/, "");

export function isMuxConfigured(): boolean {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

export class MuxError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "MuxError";
  }
}

async function mux<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const auth = Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64");
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new MuxError(`Mux ${method} ${path} failed: ${response.status} ${text.slice(0, 300)}`, response.status);
  }
  if (response.status === 204) return null;
  const json = (await response.json()) as { data: T };
  return json.data;
}

export type MuxUpload = {
  id: string;
  url: string;
  status: "waiting" | "asset_created" | "errored" | "cancelled" | "timed_out";
  asset_id?: string;
  error?: { type?: string; message?: string };
};

export type MuxAsset = {
  id: string;
  status: "preparing" | "ready" | "errored";
  duration?: number;
  aspect_ratio?: string;
  playback_ids?: { id: string; policy: string }[];
  passthrough?: string;
  errors?: { type?: string; messages?: string[] };
};

/**
 * One-time, resumable upload URL for the browser. Asset settings:
 * - basic quality: free encoding, cheapest storage;
 * - max_resolution_tier 1080p: Mux's smallest stored tier. Playback is capped
 *   separately at 720p on every URL we hand out (see playbackUrl());
 * - no MP4 renditions: nothing downloadable is created, so deleting the asset
 *   removes every copy;
 * - passthrough = our video id, so webhooks can be matched back.
 */
export async function createDirectUpload(videoId: string, corsOrigin: string): Promise<MuxUpload> {
  const upload = await mux<MuxUpload>("POST", "/video/v1/uploads", {
    cors_origin: corsOrigin,
    timeout: 6 * 60 * 60, // seconds the URL stays valid — long uploads on slow links
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
      max_resolution_tier: "1080p",
      passthrough: videoId,
    },
  });
  if (!upload) throw new MuxError("Mux did not return an upload.");
  return upload;
}

export function getUpload(uploadId: string) {
  return mux<MuxUpload>("GET", `/video/v1/uploads/${encodeURIComponent(uploadId)}`);
}

export function getAsset(assetId: string) {
  return mux<MuxAsset>("GET", `/video/v1/assets/${encodeURIComponent(assetId)}`);
}

/** Deletes the asset and everything Mux holds for it (all renditions,
 * thumbnails, the stored master). A 404 means it's already gone — success. */
export async function deleteAsset(assetId: string): Promise<void> {
  await mux("DELETE", `/video/v1/assets/${encodeURIComponent(assetId)}`);
}

/** Cancels an upload that never finished (no asset was created). */
export async function cancelUpload(uploadId: string): Promise<void> {
  try {
    await mux("PUT", `/video/v1/uploads/${encodeURIComponent(uploadId)}/cancel`);
  } catch (error) {
    // Already completed/cancelled/timed out — nothing left to cancel.
    if (error instanceof MuxError && (error.status === 400 || error.status === 409)) return;
    throw error;
  }
}

/**
 * Verifies a Mux webhook's `mux-signature` header ("t=<unix>,v1=<hex>"):
 * HMAC-SHA256 of "<t>.<raw body>" with MUX_WEBHOOK_SECRET, rejecting anything
 * older than 5 minutes (replay protection).
 */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key?.trim(), rest.join("=").trim()];
    })
  ) as Record<string, string>;
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature || !/^[0-9a-f]+$/i.test(signature)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

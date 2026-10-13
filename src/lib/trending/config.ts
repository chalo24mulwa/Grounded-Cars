// Trending feature switches and limits. Shared by server and client code, so
// nothing secret lives here.

/** The whole Trending feature (pages, utility-bar link, uploads, cleanup) is
 * off unless TRENDING_ENABLED is exactly "true". It ships switched off so the
 * code can be deployed before its database tables exist; see docs/trending.md. */
export function isTrendingEnabled(): boolean {
  return process.env.TRENDING_ENABLED === "true";
}

/** Videos are deleted completely this long after they're posted. */
export function videoTtlHours(): number {
  const hours = Number(process.env.TRENDING_VIDEO_TTL_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : 7 * 24;
}

export const MAX_VIDEO_SECONDS = 60 * 60;
// A 60-minute phone video at 1080p is roughly 5-8 GB; anything far beyond
// that is almost certainly not a normal recording.
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024 * 1024;
export const ACCEPTED_VIDEO_TYPES = "video/mp4,video/quicktime,video/webm,video/x-m4v,video/3gpp,.mov,.mp4,.m4v,.webm,.3gp";

export const CAPTION_MAX = 2200;
export const COMMENT_MAX = 500;
export const MESSAGE_MAX = 1000;
export const BIO_MAX = 160;
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,24}$/;

// Playback and thumbnail hosts. Overridable only so the feature can be tested
// end to end without a real Mux account (see docs/trending.md).
export const MUX_STREAM_BASE = process.env.NEXT_PUBLIC_MUX_STREAM_BASE || "https://stream.mux.com";
export const MUX_IMAGE_BASE = process.env.NEXT_PUBLIC_MUX_IMAGE_BASE || "https://image.mux.com";

/** HLS playlist, never offering anything above 720p (see section 6 of the
 * spec: phones choose a smaller size automatically on slow connections). */
export function playbackUrl(playbackId: string): string {
  return `${MUX_STREAM_BASE}/${playbackId}.m3u8?max_resolution=720p`;
}

/** Small WebP poster frame (~480px wide) used as the placeholder before playback. */
export function thumbnailUrl(playbackId: string, width = 480): string {
  return `${MUX_IMAGE_BASE}/${playbackId}/thumbnail.webp?width=${width}&time=1`;
}

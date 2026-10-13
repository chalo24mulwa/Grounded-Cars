"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { FeedVideo } from "@/server/services/trending/video-service";
import {
  loadFeedPageAction,
  recordViewAction,
  setVideoLikeAction,
  messageProfileAction,
  deleteVideoAction,
  setBlockedAction,
} from "@/server/actions/trending-actions";
import { TrendingVideoPlayer } from "@/components/trending/TrendingVideoPlayer";
import { CommentsSheet } from "@/components/trending/CommentsSheet";
import { ShareSheet } from "@/components/trending/ShareSheet";
import { ReportSheet } from "@/components/trending/ReportSheet";
import { BottomSheet } from "@/components/trending/BottomSheet";
import { Avatar, Icon, formatCount, expiresIn } from "@/components/trending/ui";

/**
 * The vertical, one-video-per-screen feed. Scroll/swipe snaps between videos;
 * only the visible one plays, only the next one preloads, everything else is
 * just a poster image (see TrendingVideoPlayer). More videos load as the
 * viewer nears the end.
 */
export function TrendingFeed({
  initialVideos,
  initialCursor,
  signedIn,
  continueWithFeed = false,
}: {
  initialVideos: FeedVideo[];
  initialCursor: string | null;
  signedIn: boolean;
  /** On a single-video page: after it, carry on with the general feed. */
  continueWithFeed?: boolean;
}) {
  const [videos, setVideos] = useState(initialVideos);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [feedStarted, setFeedStarted] = useState(!continueWithFeed);
  const [exhausted, setExhausted] = useState(!continueWithFeed && !initialCursor);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [height, setHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Fill the screen below the site header (whatever its height on this device).
  useLayoutEffect(() => {
    function measure() {
      const el = containerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(420, window.innerHeight - top));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Which video is on screen.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: [0.6] }
    );
    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos.length]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || exhausted) return;
    loadingRef.current = true;
    try {
      const result = await loadFeedPageAction(feedStarted ? cursor : null);
      if (!result.ok) return;
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...result.data.videos.filter((v) => !seen.has(v.id))];
      });
      setFeedStarted(true);
      setCursor(result.data.nextCursor);
      if (!result.data.nextCursor) setExhausted(true);
    } finally {
      loadingRef.current = false;
    }
  }, [cursor, exhausted, feedStarted]);

  useEffect(() => {
    if (active >= videos.length - 2) void loadMore();
  }, [active, videos.length, loadMore]);

  // Arrow keys on desktop.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest("input,textarea,[role=dialog]")) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const next = Math.min(videos.length - 1, Math.max(0, active + (e.key === "ArrowDown" ? 1 : -1)));
      containerRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ behavior: "smooth" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, videos.length]);

  return (
    <div className="bg-black">
      <div
        ref={containerRef}
        className="mx-auto h-[calc(100dvh-140px)] w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain sm:max-w-[440px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={height ? { height } : undefined}
      >
        {videos.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <p className="text-lg font-semibold">No videos yet</p>
            <p className="text-sm text-white/70">Be the first to share a car video.</p>
            <Link href="/trending/upload" className="rounded-full bg-brand-accent px-5 py-2 text-sm font-semibold">
              Upload a video
            </Link>
          </div>
        )}
        {videos.map((video, index) => (
          <FeedSlide
            key={video.id}
            index={index}
            video={video}
            mode={index === active ? "active" : index === active + 1 ? "preload" : "off"}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            signedIn={signedIn}
            onRemoved={() => setVideos((prev) => prev.filter((v) => v.id !== video.id))}
          />
        ))}
        {videos.length > 0 && exhausted && (
          <div className="flex h-40 snap-start items-center justify-center text-sm text-white/60">You&apos;re all caught up</div>
        )}
      </div>
    </div>
  );
}

function FeedSlide({
  video,
  index,
  mode,
  muted,
  onToggleMute,
  signedIn,
  onRemoved,
}: {
  video: FeedVideo;
  index: number;
  mode: "off" | "preload" | "active";
  muted: boolean;
  onToggleMute: () => void;
  signedIn: boolean;
  onRemoved: () => void;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(video.likedByMe);
  const [likes, setLikes] = useState(video.likeCount);
  const [comments, setComments] = useState(video.commentCount);
  const [sheet, setSheet] = useState<null | "comments" | "share" | "more" | "report">(null);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, start] = useTransition();
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/trending/v/${video.id}`)}`;

  useEffect(() => {
    if (mode !== "active") setPaused(false);
  }, [mode]);

  function requireLogin(): boolean {
    if (signedIn) return true;
    router.push(loginHref);
    return false;
  }

  function toggleLike() {
    if (!requireLogin()) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    start(async () => {
      const result = await setVideoLikeAction(video.id, next);
      if (result.ok) setLikes(result.data.likeCount);
      else {
        setLiked(!next);
        setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
        setNotice(result.error);
      }
    });
  }

  const carLine = [video.year, video.make, video.model].filter(Boolean).join(" ");
  const details = [
    carLine || null,
    video.price != null ? `KES ${video.price.toLocaleString()}` : null,
    video.location,
  ].filter(Boolean) as string[];

  return (
    <section data-index={index} className="relative h-full w-full snap-start snap-always overflow-hidden bg-black" aria-label={`Video by @${video.author.username}`}>
      {video.playbackId ? (
        <TrendingVideoPlayer
          playbackId={video.playbackId}
          poster={video.poster}
          mode={mode}
          muted={muted}
          paused={paused}
          onFirstPlay={() => void recordViewAction(video.id)}
        />
      ) : null}

      {/* Tap anywhere on the video to pause / play. */}
      <button
        type="button"
        aria-label={paused ? "Play" : "Pause"}
        onClick={() => setPaused((p) => !p)}
        className="absolute inset-0 z-[1] cursor-pointer"
      />
      {paused && mode === "active" && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 p-4 text-white">
          <Icon name="play" size={40} filled />
        </span>
      )}

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute right-3 top-3 z-[3] rounded-full bg-black/40 p-2 text-white"
      >
        <Icon name={muted ? "volumeOff" : "volumeOn"} size={20} />
      </button>

      {/* Right-hand action column (kept above the site's floating WhatsApp button). */}
      <div className="absolute bottom-24 right-2 z-[3] flex flex-col items-center gap-4 text-white">
        <Link href={`/trending/u/${video.author.username}`} aria-label={`@${video.author.username}'s profile`} className="rounded-full ring-2 ring-white">
          <Avatar src={video.author.avatarUrl} name={video.author.displayName} size={44} />
        </Link>
        <ActionButton label={liked ? "Unlike" : "Like"} count={likes} onClick={toggleLike} pressed={liked}>
          <Icon name="heart" size={30} filled={liked} className={clsx(liked ? "text-red-500" : "text-white")} />
        </ActionButton>
        <ActionButton label="Comments" count={comments} onClick={() => setSheet("comments")}>
          <Icon name="comment" size={28} filled />
        </ActionButton>
        <ActionButton label="Share" count={null} onClick={() => setSheet("share")}>
          <Icon name="share" size={28} filled />
        </ActionButton>
        {!video.isMine && (
          <ActionButton
            label="Message"
            count={null}
            onClick={() => {
              if (!requireLogin()) return;
              start(async () => {
                const r = await messageProfileAction(video.author.id, video.id);
                if (r && !r.ok) setNotice(r.error);
              });
            }}
          >
            <Icon name="message" size={26} />
          </ActionButton>
        )}
        <ActionButton label="More" count={null} onClick={() => setSheet("more")}>
          <Icon name="more" size={26} />
        </ActionButton>
      </div>

      {/* Caption & car details. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-4 pr-16 pt-16 text-white">
        <div className="pointer-events-auto">
          <Link href={`/trending/u/${video.author.username}`} className="text-sm font-bold">
            @{video.author.username}
          </Link>
          {video.isMine && <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">{expiresIn(video.expiresAt)}</span>}
          {video.title && <p className="mt-1 text-sm font-semibold">{video.title}</p>}
          <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 block text-left">
            <p className={clsx("whitespace-pre-wrap break-words text-sm text-white/90", !expanded && "line-clamp-2")}>{video.caption}</p>
          </button>
          {details.length > 0 && (
            <p className="mt-1 text-xs font-medium text-brand-gold">{details.join(" · ")}</p>
          )}
          {video.listing && (
            <Link href={`/cars/${video.listing.slug}`} className="mt-2 inline-block rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              View this car&apos;s listing →
            </Link>
          )}
          {notice && <p className="mt-2 rounded bg-black/60 px-2 py-1 text-xs">{notice}</p>}
        </div>
      </div>

      {sheet === "comments" && (
        <CommentsSheet
          videoId={video.id}
          count={comments}
          signedIn={signedIn}
          loginHref={loginHref}
          onClose={() => setSheet(null)}
          onCountChange={(d) => setComments((n) => Math.max(0, n + d))}
        />
      )}
      {sheet === "share" && <ShareSheet videoId={video.id} title={video.title || video.caption.slice(0, 80)} onClose={() => setSheet(null)} />}
      {sheet === "report" && <ReportSheet targetType="VIDEO" targetId={video.id} onClose={() => setSheet(null)} />}
      {sheet === "more" && (
        <BottomSheet title="More" onClose={() => setSheet(null)} height="auto">
          <div className="divide-y divide-slate-100 text-sm">
            <Link href={`/trending/u/${video.author.username}`} className="block px-4 py-3 text-slate-800">
              View @{video.author.username}&apos;s videos
            </Link>
            {video.isMine ? (
              <>
                <Link href={`/trending/edit/${video.id}`} className="block px-4 py-3 text-slate-800">
                  Edit caption
                </Link>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left font-semibold text-red-600"
                  onClick={() =>
                    start(async () => {
                      if (!window.confirm("Delete this video? It will be removed everywhere and can't be recovered.")) return;
                      const r = await deleteVideoAction(video.id);
                      setSheet(null);
                      if (r.ok) onRemoved();
                      else setNotice(r.error);
                    })
                  }
                >
                  Delete video
                </button>
              </>
            ) : (
              <>
                <button type="button" className="block w-full px-4 py-3 text-left text-slate-800" onClick={() => (requireLogin() ? setSheet("report") : null)}>
                  Report video
                </button>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left font-semibold text-red-600"
                  onClick={() => {
                    if (!requireLogin()) return;
                    start(async () => {
                      if (!window.confirm(`Block @${video.author.username}? You won't see each other's videos or messages.`)) return;
                      const r = await setBlockedAction(video.author.id, true);
                      setSheet(null);
                      if (r.ok) onRemoved();
                      else setNotice(r.error);
                    });
                  }}
                >
                  Block @{video.author.username}
                </button>
              </>
            )}
          </div>
        </BottomSheet>
      )}
    </section>
  );
}

function ActionButton({
  label,
  count,
  onClick,
  pressed,
  children,
}: {
  label: string;
  count: number | null;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className="flex flex-col items-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      {children}
      {count !== null && <span className="mt-0.5 text-xs font-semibold">{formatCount(count)}</span>}
    </button>
  );
}

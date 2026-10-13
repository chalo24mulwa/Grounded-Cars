"use client";

import { useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import { playbackUrl } from "@/lib/trending/config";

// One video in the feed. Network/memory rules (spec section 6):
// - "off": nothing loaded — just the small WebP poster. Videos scrolled past
//   are released completely, so phones don't run out of memory.
// - "preload": the NEXT video — loads only its first few seconds.
// - "active": the one on screen — plays (muted until the viewer unmutes).
// Streams are HLS capped at 720p (playbackUrl), starting at the smallest size
// and stepping up as the connection allows. hls.js is loaded on demand, only
// on Trending pages and only where the browser can't play HLS natively.

type Mode = "off" | "preload" | "active";

let hlsModule: Promise<typeof HlsType> | null = null;
function loadHls() {
  hlsModule ??= import("hls.js/light").then((m) => m.default);
  return hlsModule;
}

export function TrendingVideoPlayer({
  playbackId,
  poster,
  mode,
  muted,
  paused,
  onFirstPlay,
}: {
  playbackId: string;
  poster: string | null;
  mode: Mode;
  muted: boolean;
  paused: boolean;
  onFirstPlay?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const [ready, setReady] = useState(false);
  const playedRef = useRef(false);

  // Attach / detach the stream.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (mode === "off") {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (video.getAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
      setReady(false);
      return;
    }

    const src = playbackUrl(playbackId);
    let cancelled = false;
    if (hlsRef.current) {
      // Already attached (was preloading): just allow a normal buffer now.
      if (mode === "active") hlsRef.current.config.maxBufferLength = 30;
      return;
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      if (video.getAttribute("src") !== src) {
        video.preload = mode === "active" ? "auto" : "metadata";
        video.src = src;
      }
    } else {
      loadHls().then((Hls) => {
        if (cancelled || !Hls.isSupported()) return;
        const hls = new Hls({
          startLevel: 0, // start with the smallest size, then adapt
          capLevelToPlayerSize: true,
          maxBufferLength: mode === "active" ? 30 : 4,
          maxMaxBufferLength: 60,
          backBufferLength: 10,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;
      });
    }
    return () => {
      cancelled = true;
    };
  }, [mode, playbackId]);

  // Destroy on unmount.
  useEffect(
    () => () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    },
    []
  );

  // Play / pause.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (mode === "active" && !paused) {
      const attempt = video.play();
      attempt?.catch(() => {
        // Autoplay with sound blocked — fall back to muted autoplay.
        video.muted = true;
        video.play().catch(() => undefined);
      });
    } else {
      video.pause();
    }
  }, [mode, paused, muted]);

  return (
    <>
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading={mode === "off" ? "lazy" : "eager"}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${ready ? "opacity-0" : "opacity-100"}`}
        />
      )}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        loop
        muted={muted}
        preload="none"
        onPlaying={() => {
          setReady(true);
          if (!playedRef.current) {
            playedRef.current = true;
            onFirstPlay?.();
          }
        }}
      />
    </>
  );
}

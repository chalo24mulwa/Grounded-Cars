"use client";

import { useState } from "react";
import { recordShareAction } from "@/server/actions/trending-actions";
import { BottomSheet } from "@/components/trending/BottomSheet";

// Official share URLs for apps that have one; the phone's own share menu
// (navigator.share) for everything else — that's the supported way to reach
// Instagram, TikTok and any other installed app from a website. Nothing is
// posted on the user's behalf.
export function ShareSheet({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/trending/v/${videoId}`;
  const text = `${title} — on Car Marketplace Trending`;
  const enc = encodeURIComponent;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const links = [
    { label: "WhatsApp", color: "bg-[#25D366]", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { label: "Facebook", color: "bg-[#1877F2]", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X", color: "bg-black", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}` },
    { label: "Telegram", color: "bg-[#229ED9]", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { label: "Email", color: "bg-slate-600", href: `mailto:?subject=${enc(text)}&body=${enc(url)}` },
  ];

  function shared() {
    void recordShareAction(videoId);
  }

  return (
    <BottomSheet title="Share to" onClose={onClose} height="auto">
      <div className="grid grid-cols-4 gap-4 p-4 sm:grid-cols-5">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.label === "Email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            onClick={shared}
            className="flex flex-col items-center gap-1.5 text-xs font-medium text-slate-700"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${link.color}`}>
              {link.label === "X" ? "𝕏" : link.label[0]}
            </span>
            {link.label}
          </a>
        ))}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => undefined);
            setCopied(true);
            shared();
          }}
          className="flex flex-col items-center gap-1.5 text-xs font-medium text-slate-700"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-lg">🔗</span>
          {copied ? "Copied!" : "Copy link"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={() => {
              navigator.share({ title: text, text, url }).then(shared).catch(() => undefined);
            }}
            className="flex flex-col items-center gap-1.5 text-center text-xs font-medium text-slate-700"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#515bd4] text-lg text-white">
              ⋯
            </span>
            Instagram, TikTok & more
          </button>
        )}
      </div>
      {!canNativeShare && (
        <p className="px-4 pb-4 text-xs text-slate-500">
          To post on Instagram or TikTok, copy the link and paste it into the app.
        </p>
      )}
    </BottomSheet>
  );
}

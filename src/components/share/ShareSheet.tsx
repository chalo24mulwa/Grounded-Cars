"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { siteConfig } from "@/config/site";
import type { ShareTarget } from "@/components/share/ShareButton";

type Platform = {
  key: string;
  label: string;
  color: string;
  icon: React.ReactNode;
  /** A link to open, or an action for apps without a web share link. */
  href?: string;
  action?: () => void;
};

/**
 * Share menu, in the order: WhatsApp, WhatsApp Business, Facebook,
 * Instagram, then the others. Nothing is ever posted on the visitor's behalf.
 * Each option opens that app (or its website) with the message ready, and
 * the visitor sends it themselves.
 *
 * Rendered into <body> so a card's overflow/rounded corners can't clip it.
 * Clicks are stopped at the sheet's root so they never reach the card link
 * the Share button sits in.
 */
export function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const imageFile = useRef<File | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const url = useMemo(() => {
    const origin = window.location.origin;
    return target.path ? `${origin}${target.path}` : window.location.href.split("#")[0] ?? window.location.href;
  }, [target.path]);
  const headline = target.subtitle ? `${target.title} – ${target.subtitle}` : target.title;
  const message = `${headline}\n${url}`;
  const enc = encodeURIComponent;

  const isAndroid = /Android/i.test(navigator.userAgent);
  const canNativeShare = typeof navigator.share === "function";

  // Close on Escape, lock page scroll, focus the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Instagram shares pictures, not links. Fetch the photo now so tapping
  // Instagram can hand it over instantly (phones only allow the share menu
  // right after a tap, not after a download).
  useEffect(() => {
    if (!target.imageUrl || !canNativeShare || typeof navigator.canShare !== "function") return;
    let cancelled = false;
    fetch(target.imageUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        const ext = blob.type.split("/")[1] || "jpg";
        const file = new File([blob], `car-marketplace.${ext}`, { type: blob.type });
        if (navigator.canShare({ files: [file] })) imageFile.current = file;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [target.imageUrl, canNativeShare]);

  function copyLink() {
    void navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  async function shareToInstagram() {
    // Instagram drops captions from shares, so the link goes to the clipboard
    // first and can be pasted into the post, story or DM.
    void navigator.clipboard?.writeText(message).catch(() => undefined);
    if (canNativeShare) {
      try {
        const file = imageFile.current;
        if (file) await navigator.share({ files: [file], text: message });
        else await navigator.share({ title: headline, text: headline, url });
        setNotice("Choose Instagram in the menu. The link is copied, so you can paste it into your story, post or message.");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    setNotice("Link copied. Paste it into your Instagram post, story or message.");
  }

  async function shareMore() {
    try {
      await navigator.share({ title: headline, text: headline, url });
    } catch {
      /* closed by the visitor */
    }
  }

  // WhatsApp Business has no separate web link. On Android it can be opened
  // directly (falling back to normal WhatsApp if it isn't installed); on
  // iPhone and computers the same WhatsApp link opens whichever WhatsApp the
  // visitor uses.
  const waLink = `https://wa.me/?text=${enc(message)}`;
  const waBusinessLink = isAndroid
    ? `intent://send?text=${enc(message)}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${enc(waLink)};end`
    : waLink;

  const platforms: Platform[] = [
    { key: "whatsapp", label: "WhatsApp", color: "bg-[#25D366]", icon: <WhatsAppGlyph />, href: waLink },
    { key: "whatsapp-business", label: "WhatsApp Business", color: "bg-[#128C7E]", icon: <WhatsAppGlyph business />, href: waBusinessLink },
    { key: "facebook", label: "Facebook", color: "bg-[#1877F2]", icon: <Letters text="f" big />, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: "instagram", label: "Instagram", color: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]", icon: <CameraGlyph />, action: shareToInstagram },
    { key: "x", label: "X (Twitter)", color: "bg-black", icon: <Letters text="X" />, href: `https://twitter.com/intent/tweet?text=${enc(headline)}&url=${enc(url)}` },
    { key: "telegram", label: "Telegram", color: "bg-[#229ED9]", icon: <PlaneGlyph />, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(headline)}` },
    { key: "linkedin", label: "LinkedIn", color: "bg-[#0A66C2]", icon: <Letters text="in" />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { key: "sms", label: "SMS", color: "bg-emerald-600", icon: <BubbleGlyph />, href: `sms:?&body=${enc(message)}` },
    { key: "email", label: "Email", color: "bg-slate-600", icon: <MailGlyph />, href: `mailto:?subject=${enc(`${headline} | ${siteConfig.name}`)}&body=${enc(message)}` },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="share-sheet-title" className="text-base font-bold text-slate-900">
              Share to
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">{headline}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <ul className="grid grid-cols-4 gap-x-2 gap-y-4 px-4 py-5">
          {platforms.map((p) => (
            <li key={p.key}>
              {p.href ? (
                <a
                  href={p.href}
                  target={p.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 text-center text-[11px] font-medium leading-tight text-slate-700"
                >
                  <Tile color={p.color}>{p.icon}</Tile>
                  {p.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={p.action}
                  className="flex w-full flex-col items-center gap-1.5 text-center text-[11px] font-medium leading-tight text-slate-700"
                >
                  <Tile color={p.color}>{p.icon}</Tile>
                  {p.label}
                </button>
              )}
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                copyLink();
                setCopied(true);
              }}
              className="flex w-full flex-col items-center gap-1.5 text-center text-[11px] font-medium leading-tight text-slate-700"
            >
              <Tile color="bg-slate-200 text-slate-700">
                <LinkGlyph />
              </Tile>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </li>
          {canNativeShare && (
            <li>
              <button
                type="button"
                onClick={shareMore}
                className="flex w-full flex-col items-center gap-1.5 text-center text-[11px] font-medium leading-tight text-slate-700"
              >
                <Tile color="bg-slate-200 text-slate-700">
                  <DotsGlyph />
                </Tile>
                More apps
              </button>
            </li>
          )}
        </ul>

        {notice && <p className="mx-4 mb-2 rounded-md bg-brand/10 px-3 py-2 text-sm text-slate-700">{notice}</p>}
      </div>
    </div>,
    document.body
  );
}

function Tile({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm ${color}`}>{children}</span>;
}

function Letters({ text, big = false }: { text: string; big?: boolean }) {
  return <span className={big ? "text-2xl font-bold leading-none" : "text-base font-bold leading-none"}>{text}</span>;
}

// Same glyph as the site's floating WhatsApp button.
function WhatsAppGlyph({ business = false }: { business?: boolean }) {
  return (
    <span className="relative">
      <svg viewBox="0 0 32 32" width="26" height="26" fill="currentColor" aria-hidden="true">
        <path d="M16.02 3C9.4 3 4 8.36 4 14.94c0 2.2.6 4.26 1.65 6.04L4 29l8.24-2.18a12.9 12.9 0 0 0 3.78.57h.01c6.62 0 12.02-5.36 12.02-11.94C28.05 8.36 22.65 3 16.02 3zm0 21.8h-.01a10.1 10.1 0 0 1-5.14-1.41l-.37-.22-3.89 1.03 1.04-3.78-.24-.39a9.83 9.83 0 0 1-1.5-5.09c0-5.46 4.47-9.9 9.98-9.9 5.5 0 9.97 4.44 9.97 9.9 0 5.46-4.47 9.9-9.99 9.9zm5.47-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47a8.97 8.97 0 0 1-1.66-2.06c-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z" />
      </svg>
      {business && (
        <span className="absolute -bottom-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-[#128C7E]">
          B
        </span>
      )}
    </span>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CameraGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" {...stroke} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
function PlaneGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...stroke} aria-hidden="true">
      <path d="M21 4L3 11l6 2 2 6 3-4 4 3 3-14z" />
      <path d="M9 13l12-9" />
    </svg>
  );
}
function BubbleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...stroke} aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}
function MailGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...stroke} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function LinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...stroke} aria-hidden="true">
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
function DotsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

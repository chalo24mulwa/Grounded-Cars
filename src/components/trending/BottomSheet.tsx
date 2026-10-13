"use client";

import { useEffect } from "react";
import { Icon } from "@/components/trending/ui";

/** TikTok-style sheet that slides up from the bottom (centered dialog on
 * wide screens). Closes on backdrop tap or Escape. */
export function BottomSheet({
  title,
  onClose,
  children,
  height = "70vh",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  height?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        style={{ maxHeight: height === "auto" ? "85vh" : height, height: height === "auto" ? undefined : height }}
      >
        <div className="relative flex items-center justify-center border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 rounded-full p-1 text-slate-500 hover:bg-slate-100">
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

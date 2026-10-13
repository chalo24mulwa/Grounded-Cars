"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the inbox every 10 s while it's open (simple polling — no
 * paid real-time service). Pauses while the tab is in the background. */
export function InboxAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}

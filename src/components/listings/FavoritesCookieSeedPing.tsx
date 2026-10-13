"use client";

import { useEffect } from "react";

export function FavoritesCookieSeedPing() {
  useEffect(() => {
    // Once per tab session is plenty; a failure just means the next page
    // uses the slower lookup and tries again.
    try {
      if (sessionStorage.getItem("cm_fav_seeded")) return;
      sessionStorage.setItem("cm_fav_seeded", "1");
    } catch {
      /* storage unavailable: still try once */
    }
    void fetch("/api/favorites/sync", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  }, []);
  return null;
}

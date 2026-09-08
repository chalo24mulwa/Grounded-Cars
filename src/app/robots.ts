import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Everything under /account, /dashboard, /admin, /favorites, and /api is
// authenticated or system-only — none of it is meant to be indexed, and
// disallowing it here also keeps crawlers from wasting the marketplace's
// (currently single-process, see rate-limit.ts) request budget on pages
// that always 404/redirect for an anonymous crawler anyway.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/dashboard", "/admin", "/favorites", "/api"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}

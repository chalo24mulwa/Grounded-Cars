/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Add object storage / CDN hostnames here as they're chosen in Phase 3
    // e.g. remotePatterns: [{ protocol: 'https', hostname: '*.r2.dev' }]
    // placehold.co is allowed only because prisma/seed.ts uses it for the
    // one seeded dev listing — next/image otherwise refuses to render any
    // unconfigured external host, which crashed the public /cars page
    // whenever the seed script had been run. Remove once Phase 3 wires up
    // real object storage and the seed script points at it instead.
    remotePatterns: [{ protocol: "https", hostname: "placehold.co" }],
    // Performance: fewer, phone-oriented widths. Each width is a separate
    // file the optimizer has to produce (on a small shared CPU) and cache;
    // the defaults went up to 3840px, which nothing on this site needs — the
    // largest source image is ~1700px wide. Must stay covered by
    // VARIANT_WIDTHS in src/lib/upload-variants.ts, which the uploaded-photo
    // loader uses with these same lists.
    deviceSizes: [640, 828, 1080, 1280, 1920],
    imageSizes: [96, 128, 256, 384],
    formats: ["image/webp"],
    // Optimized copies of public/ images were only kept for 60 seconds
    // (public/ files are served without a long cache lifetime), so the
    // optimizer redid the same resize again and again. 30 days; to change one
    // of those images, give the new file a new name.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // Next.js's own default (1MB) is far below what this app's own UI
    // advertises: ListingForm's create flow submits every selected photo
    // in one Server Action call (see createListingFormAction), and
    // storage.ts's own MAX_IMAGES_PER_LISTING (10) × MAX_MB (5) puts the
    // real worst case at 50MB — the default silently crashed with "Body
    // exceeded 1 MB limit" the moment a real, normal-sized photo was
    // attached (a small enough test photo never hit it, which is why this
    // went unnoticed in earlier local/dev testing).
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Separate from the Server Action limit above: src/middleware.ts matches
    // /dashboard/*, so Next buffers every request body passing through it
    // and silently truncates at 10MB by default. A listing with several
    // phone photos easily exceeds that, and the cut-off multipart body
    // then fails to parse ("Unexpected end of form") — the generic
    // "Something went wrong" seen when submitting a listing. Kept equal to
    // the Server Action limit so the two can't disagree.
    middlewareClientMaxBodySize: "50mb",
  },
  // www.carmarketplace.co.ke and carmarketplace.co.ke were both resolving
  // and serving identical content with no redirect between them — a real
  // duplicate-domain issue (confirmed live: both returned 200 for the same
  // page). The non-www form is canonical everywhere else already
  // (siteConfig, NEXT_PUBLIC_APP_URL, every page's `alternates.canonical`,
  // the Google Search Console property that's actually verified), so this
  // permanently redirects the www host to it rather than the other way
  // around. Host-based matching, not a DNS-level fix, since this app has
  // no control over DNS/vhost config on this host.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.carmarketplace.co.ke" }],
        destination: "https://carmarketplace.co.ke/:path*",
        permanent: true,
      },
    ];
  },
  // Phase 9 hardening — applied to every response, not just pages: static
  // assets (including seller-uploaded images under /uploads) get these too,
  // which matters since X-Content-Type-Options is what stops a browser from
  // ever executing an uploaded file as something other than its declared
  // Content-Type, no matter what its actual bytes contain (see
  // src/lib/storage.ts for the upload-time validation this backs up).
  async headers() {
    return [
      // Brand assets and page artwork in public/ — Next serves these with no
      // browser cache lifetime at all, so every page view re-checked them.
      // A day of caching plus a week of background revalidation; rename a
      // file when replacing it if the change must show up immediately.
      {
        source: "/:dir(brand|images)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

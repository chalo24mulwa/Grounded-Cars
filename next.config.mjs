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
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Phase 9 hardening — applied to every response, not just pages: static
  // assets (including seller-uploaded images under /uploads) get these too,
  // which matters since X-Content-Type-Options is what stops a browser from
  // ever executing an uploaded file as something other than its declared
  // Content-Type, no matter what its actual bytes contain (see
  // src/lib/storage.ts for the upload-time validation this backs up).
  async headers() {
    return [
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

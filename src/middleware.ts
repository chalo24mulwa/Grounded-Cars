import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe: this instance is built from authConfig only, which has no
// Prisma adapter and no bcrypt-based provider, so it can run in the Edge
// middleware runtime. It decodes the existing session JWT to gate access to
// protected route prefixes — the actual allow/deny/redirect rules live in
// authConfig.callbacks.authorized (src/lib/auth.config.ts).
//
// This is route-level gating only, and defense in depth, not the
// authoritative check: every protected page/action also re-verifies
// authentication and role server-side (see src/server/authorization/) in
// case middleware is ever bypassed or misconfigured.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/account/:path*", "/dashboard/:path*", "/admin/:path*", "/favorites/:path*"],
};

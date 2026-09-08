import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

// ----------------------------------------------------------------------------
// Edge-safe half of the Auth.js config. This file must NEVER import Prisma
// or bcrypt (both are Node-only) — it's shared between the full server
// config (src/lib/auth.ts) and the lightweight instance middleware.ts builds
// for route protection, and middleware runs in the Edge runtime.
//
// The `jwt`/`session` callbacks here are pure token transforms (no DB
// calls), so they're safe to share. `authorized` is what actually gates
// /account, /dashboard, /admin — see middleware.ts for how it's wired up.
// ----------------------------------------------------------------------------

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // real providers (Credentials + bcrypt) are added in src/lib/auth.ts
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id as string;
      }
      // A role change (e.g. becomeSeller()) writes straight to the User
      // row, not the JWT — without this, a BUYER who just upgraded to
      // SELLER would be bounced by middleware until their next login,
      // since the token still carries the role from sign-in time. Any
      // server-side call to `unstable_update({ user: { role } })` (see
      // becomeSellerAction) lands here as `trigger === "update"`.
      if (trigger === "update" && session?.user?.role) {
        token.role = session.user.role;
      }
      // Admin impersonation (startImpersonationAction/endImpersonationAction
      // in admin-actions.ts) swaps `id`/`role` to act as another user, and
      // separately stashes/clears `impersonatorId` — the ORIGINAL admin's
      // id — so the swap can be audited and reversed. `session.user.id`
      // is only ever present on this trigger for that one purpose (a plain
      // role-only update, like becomeSeller's, never sends an id). Checking
      // "impersonatorId" in session (rather than truthiness) is what lets a
      // caller explicitly clear it back to undefined on exit.
      if (trigger === "update" && session) {
        if (session.user?.id) token.id = session.user.id;
        // name/email ride along with id so every existing "welcome back,
        // {name}" / display-only read of session.user during impersonation
        // shows the user actually being acted as, not the admin who's
        // driving — the same reason startImpersonation() fetches them.
        if (session.user?.name !== undefined) token.name = session.user.name;
        if (session.user?.email !== undefined) token.email = session.user.email;
        if ("impersonatorId" in session) {
          token.impersonatorId = session.impersonatorId ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "BUYER" | "SELLER" | "ADMIN" | "MODERATOR";
      }
      session.impersonatorId = token.impersonatorId as string | undefined;
      return session;
    },
    authorized({ auth, request }) {
      const role = auth?.user?.role;
      const { pathname, origin } = request.nextUrl;

      // Middleware's matcher (see middleware.ts) only invokes this for
      // /account, /dashboard, and /admin — anything else never reaches
      // here, so no "is this even a protected route" check is needed.
      if (!auth?.user) return false; // → Auth.js redirects to pages.signIn with a callbackUrl

      if (pathname.startsWith("/admin") && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/account?error=forbidden", origin));
      }
      if (
        pathname.startsWith("/dashboard") &&
        role !== "SELLER" &&
        role !== "ADMIN" &&
        role !== "MODERATOR"
      ) {
        return NextResponse.redirect(new URL("/account?error=forbidden", origin));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;

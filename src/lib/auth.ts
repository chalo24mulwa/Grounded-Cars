import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google, { type GoogleProfile } from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { authConfig } from "@/lib/auth.config";

// ----------------------------------------------------------------------------
// Auth.js (NextAuth v5) configuration — the full, Node-only half. This is
// where Prisma and bcrypt actually get used, which is why it's a separate
// file from auth.config.ts (that one has to stay Edge-safe for
// middleware.ts). `jwt`/`session`/`authorized` callbacks and `pages` are
// shared from authConfig rather than duplicated here.
//
// Design decisions worth flagging:
// - Role lives on the User row in our own database (not in a third-party
//   auth provider), and is attached to the session via the `session`
//   callback in auth.config.ts. This is the ONLY place role is read from
//   the DB into the session — every authorization check downstream trusts
//   `session.user.role`, never a client-supplied value.
// - New users self-registering always get role = BUYER at the database
//   default level (see schema.prisma). There is no code path here — or
//   anywhere in the app — that lets a signup payload set `role` directly.
//   Promoting a user to SELLER or ADMIN is an explicit, separate,
//   authorized action (registration stays BUYER-only; becomeSeller() in
//   auth-service.ts is the one path to SELLER; ADMIN is never
//   self-serviceable), never part of registration input.
// ----------------------------------------------------------------------------

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// A transient dropped database connection (e.g. Prisma's pooled connection
// to Neon being closed server-side — see docs/deployment.md's pooling
// notes) surfaces here as a plain thrown error. Left uncaught, Auth.js's
// Credentials provider reports that as a generic CredentialsSignin — shown
// to the user as "Invalid email or password," indistinguishable from an
// actually-wrong password. One retry gives Prisma's pool a chance to hand
// back a fresh connection before a sign-in attempt fails for a reason that
// had nothing to do with the submitted credentials.
async function withRetryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("Transient database error during sign-in, retrying once:", error);
    return await fn();
  }
}

export const { handlers, signIn, signOut, auth, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await withRetryOnce(() => prisma.user.findUnique({ where: { email } }));
        if (!user || !user.passwordHash) return null;
        if (user.status !== "ACTIVE") return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    // clientId/clientSecret are intentionally omitted here — Auth.js's
    // Next.js integration auto-populates them from AUTH_GOOGLE_ID /
    // AUTH_GOOGLE_SECRET (its standard AUTH_<PROVIDERID>_ID/_SECRET
    // convention), so no env var is ever read directly in source. Both are
    // blank until real credentials are issued (see .env.example) — Auth.js
    // then simply fails a sign-in attempt with a "Configuration" error
    // rather than crashing, the same "not configured yet" posture already
    // used for M-Pesa (see isMpesaConfigured() in lib/mpesa.ts).
    //
    // allowDangerousEmailAccountLinking is what makes "same verified email,
    // different sign-in method" link to the existing user instead of
    // throwing OAuthAccountNotLinked — safe here specifically because the
    // signIn callback below independently re-verifies Google's own
    // email_verified claim (and the existing account's status) before ever
    // allowing that link, so an unverified/spoofed email can't hijack an
    // existing account merely by matching it.
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Only exercised for the google provider — the credentials provider's
    // own authorize() above has already fully verified the account (status,
    // password) by the time this callback would run for it, so it's a
    // pure no-op passthrough for "credentials", never adding a second check
    // or changing that flow's existing behavior.
    async signIn({ account, user, profile }) {
      if (account?.provider !== "google") return true;

      // Google's own asserted verification flag — this is what makes
      // allowDangerousEmailAccountLinking above actually safe: an account
      // is only ever linked/created off an email Google itself vouches for,
      // never a bare claim trusted from the browser.
      const googleProfile = profile as GoogleProfile | undefined;
      if (!googleProfile?.email_verified) return false;

      const email = user.email;
      if (!email) return false;

      // If this email already belongs to an existing (e.g. password-based)
      // account, mirror the exact same "must be ACTIVE" rule the
      // Credentials provider's authorize() enforces above — a suspended
      // user can't bypass that by signing in with Google instead. A
      // first-time signup (no existing row yet) has nothing to check here;
      // it proceeds to account creation via the Prisma adapter as normal.
      const existing = await withRetryOnce(() =>
        prisma.user.findUnique({
          where: { email },
          select: { status: true },
        })
      );
      if (existing && existing.status !== "ACTIVE") return false;

      return true;
    },
  },
});

import type { UserRole } from "@prisma/client";
import "next-auth";

// Extends Auth.js's built-in Session/User types so `session.user.role` and
// `session.user.id` are known, typed values everywhere in the app instead
// of `any` — this is what lets the authorization layer be fully type-safe.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    // Present only while an admin is impersonating this session's user —
    // holds the ORIGINAL admin's id, so impersonation can be audited and
    // ended (restoring exactly that admin, never a different one). Set only
    // by startImpersonationAction/endImpersonationAction via updateSession()
    // — never client-suppliable, since it lives inside the signed JWT.
    impersonatorId?: string | null;
  }

  interface User {
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    impersonatorId?: string;
  }
}

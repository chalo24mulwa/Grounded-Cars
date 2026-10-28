import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { UserRole } from "@prisma/client";

// Lets a mobile API route hand requireAuth() (ownership.ts) an already-
// verified identity, since mobile requests carry a Bearer token instead of
// the httpOnly session cookie auth() reads. Nothing in the website's own
// request path ever calls .run() on this, so getStore() returns undefined
// for every existing web request and requireAuth() falls through to auth()
// exactly as before — this file only matters once a mobile route handler
// explicitly opts in via withMobileAuth (see with-mobile-auth.ts).
export type MobileSessionUser = {
  id: string;
  role: UserRole;
  email: string;
  name: string;
};

export const mobileSessionContext = new AsyncLocalStorage<MobileSessionUser>();

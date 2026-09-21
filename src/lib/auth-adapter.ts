import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";

// The stock Prisma adapter assumes the User table has an `image` column and
// tries to save the person's Google profile-picture URL into it. This app's
// User model deliberately has no such column (nothing on the site displays a
// profile picture), so the very first Google sign-up crashed with
// "Unknown argument `image`" and Auth.js showed its generic "Configuration"
// error page — even though Google itself had signed the user in fine.
//
// Rather than change the production database for a value nothing uses, the
// picture is dropped here, before it reaches Prisma. Everything else the
// adapter does (creating the user, linking the Google account) is untouched.
export function createAuthAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    createUser: ({ image: _image, ...data }) => base.createUser!(data),
    updateUser: ({ image: _image, ...data }) => base.updateUser!(data),
  };
}

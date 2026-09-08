import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern: without this, hot-reloading in
// development spawns a new PrismaClient (and DB connection pool) on every
// file save, which exhausts Postgres connections quickly — especially
// important here since production will likely sit behind a shared-hosting
// connection limit and/or an external pooled Postgres provider.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

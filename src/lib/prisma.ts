import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern: without this, hot-reloading in
// development spawns a new PrismaClient (and DB connection pool) on every
// file save, which exhausts Postgres connections quickly — especially
// important here since production will likely sit behind a shared-hosting
// connection limit and/or an external pooled Postgres provider.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

// A transient dropped connection (Prisma's pooled connection to Neon being
// closed server-side — see docs/deployment.md's pooling notes) throws on
// whatever query happens to be using it. Left unhandled, that surfaces as
// a crashed page for a reason that had nothing to do with the request
// itself — and this isn't rare per-call-site: SiteHeader's
// getCategoryCounts() alone runs this risk on literally every page in the
// app. Retrying once, transparently, at the client level fixes that
// everywhere at once instead of wrapping every individual call site.
//
// Scoped to read operations only (never create/update/upsert/delete) —
// a write that throws after the connection actually closed mid-commit
// could otherwise risk a double-write on retry; a failed write should
// just surface normally and let the user resubmit, exactly as before.
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

function isTransientConnectionError(error: unknown): boolean {
  return error instanceof Error && /kind:\s*Closed/i.test(error.message);
}

export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ operation, model, args, query }) {
      try {
        return await query(args);
      } catch (error) {
        if (!READ_OPERATIONS.has(operation) || !isTransientConnectionError(error)) {
          throw error;
        }
        console.error(`Transient database error on ${model ?? ""}.${operation}, retrying once:`, error);
        return await query(args);
      }
    },
  },
}) as unknown as PrismaClient;

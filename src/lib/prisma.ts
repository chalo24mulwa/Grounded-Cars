import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern: without this, hot-reloading in
// development spawns a new PrismaClient (and DB connection pool) on every
// file save, which exhausts Postgres connections quickly — especially
// important here since production will likely sit behind a shared-hosting
// connection limit and/or an external pooled Postgres provider.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Connection-string tuning for a serverless Postgres (Neon) that suspends its
// compute when idle. Only fills in parameters the URL doesn't already set, so
// an explicit value in DATABASE_URL always wins:
// - connection_limit: Prisma's default pool size scales with the host's CPU
//   count, which on shared hosting can be dozens of connections. After a quiet
//   period the database closes all of them, and every stale one then fails its
//   next query ("Closed"). A small pool means far fewer stale connections to
//   trip over, and the retry below can clear all of them.
// - connect_timeout: waking a suspended Neon compute routinely takes longer
//   than Prisma's 5s default, which then fails as a spurious connection error.
// - pool_timeout: how long a query waits for a free connection.
function tunedDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const defaults: Record<string, string> = {
      connection_limit: "5",
      connect_timeout: "20",
      pool_timeout: "20",
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    // Unparseable here — let Prisma read (and report on) the variable itself.
    return undefined;
  }
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: tunedDatabaseUrl(),
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

export function isTransientConnectionError(error: unknown): boolean {
  return error instanceof Error && /kind:\s*Closed/i.test(error.message);
}

/**
 * Runs `run`, retrying only when it fails with a dropped-connection error
 * (anything else is rethrown immediately). One retry isn't always enough:
 * after a quiet period the pool can hold several dead connections, and each
 * failed attempt only discards the one it used, so a few attempts walk
 * through all of them to a live (or freshly opened) one.
 */
export async function retryOnTransientConnectionError<T>(
  run: () => Promise<T>,
  maxAttempts: number,
  label: string
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isTransientConnectionError(error) || attempt >= maxAttempts) throw error;
      console.error(`Transient database error on ${label} (attempt ${attempt}/${maxAttempts}), retrying:`, error);
    }
  }
}

const MAX_READ_ATTEMPTS = 4;

export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ operation, model, args, query }) {
      if (!READ_OPERATIONS.has(operation)) return query(args);
      return retryOnTransientConnectionError(() => query(args), MAX_READ_ATTEMPTS, `${model ?? ""}.${operation}`);
    },
  },
}) as unknown as PrismaClient;

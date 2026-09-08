// ----------------------------------------------------------------------------
// Startup environment validation (Phase 10). Runs once, from
// instrumentation.ts, before the app starts serving real traffic —
// deliberately server-side and boot-time, not something a request handler
// re-checks per request. Two jobs:
//
//   1. FAIL FAST on a genuinely broken config (missing DB URL, the literal
//      placeholder AUTH_SECRET from .env.example) — these can never work
//      correctly, so refusing to boot is safer than serving broken/insecure
//      traffic.
//   2. WARN LOUDLY (never block) on a config that's *technically* runnable
//      but looks like a wrong-environment mistake — e.g. NODE_ENV=production
//      pointed at a localhost database, which is exactly the "staging
//      accidentally talking to production" (or the reverse) class of bug
//      this phase's Environment Strategy section asks to guard against.
//      These stay warnings because they're heuristics — a legitimately
//      unusual-but-correct setup (e.g. a local Postgres in a containerized
//      staging environment) shouldn't be hard-blocked by a guess.
// ----------------------------------------------------------------------------

const PLACEHOLDER_AUTH_SECRET = "replace-with-a-long-random-value";

function looksLocal(url: string | undefined): boolean {
  if (!url) return false;
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url);
}

export function validateEnvironment(): void {
  const env = process.env.NODE_ENV;
  const isProduction = env === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is not set.");
  }
  if (!process.env.AUTH_SECRET) {
    errors.push("AUTH_SECRET is not set.");
  } else if (process.env.AUTH_SECRET === PLACEHOLDER_AUTH_SECRET) {
    errors.push(
      "AUTH_SECRET is still the placeholder value from .env.example — generate a real one with `npx auth secret`."
    );
  }

  if (isProduction) {
    if (looksLocal(process.env.DATABASE_URL)) {
      errors.push(
        "NODE_ENV=production but DATABASE_URL points at localhost — this looks like a dev/staging config accidentally deployed as production."
      );
    }
    if (looksLocal(process.env.NEXT_PUBLIC_APP_URL) || looksLocal(process.env.AUTH_URL)) {
      errors.push(
        "NODE_ENV=production but NEXT_PUBLIC_APP_URL/AUTH_URL points at localhost — callback URLs (M-Pesa, password reset, notification emails) would be unreachable from the internet."
      );
    }
    if (process.env.MPESA_ENV === "sandbox" && process.env.MPESA_CONSUMER_KEY) {
      warnings.push(
        "NODE_ENV=production but MPESA_ENV=sandbox — real payments would go through Safaricom's sandbox, not production. Set MPESA_ENV=production once the live Till/credentials are ready."
      );
    }
    if ((process.env.EMAIL_PROVIDER ?? "console") === "console") {
      warnings.push(
        "NODE_ENV=production with EMAIL_PROVIDER unset/console — password-reset and notification emails will only be logged server-side, never actually delivered to users."
      );
    }
  } else {
    // The inverse mistake: a non-production environment pointed at what
    // looks like a real production database is exactly what "development
    // and staging must never accidentally connect to the production
    // database" (spec) is about — this can't be detected with certainty
    // from the URL alone, so it's a warning based on the absence of any
    // local/staging marker, not a guess at what IS production.
    if (process.env.DATABASE_URL && !looksLocal(process.env.DATABASE_URL)) {
      const url = process.env.DATABASE_URL;
      const looksLikeKnownNonProdHost = /neon\.tech|supabase\.co|-dev\.|-staging\.|_dev\?|_staging\?/i.test(
        url
      );
      if (!looksLikeKnownNonProdHost) {
        warnings.push(
          `NODE_ENV=${env ?? "(unset)"} but DATABASE_URL points at a non-local host with no obvious dev/staging marker in its name — double-check this isn't the production database before running migrations or seed scripts here.`
        );
      }
    }
  }

  for (const warning of warnings) {
    console.warn(`[env-check] WARNING: ${warning}`);
  }

  if (errors.length > 0) {
    const message = `[env-check] Refusing to start — invalid environment configuration:\n${errors
      .map((e) => `  - ${e}`)
      .join("\n")}`;
    console.error(message);
    throw new Error(message);
  }
}

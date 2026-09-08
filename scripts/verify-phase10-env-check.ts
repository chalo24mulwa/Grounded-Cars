/**
 * Verifies env-check.ts's fail-fast / warn logic against several
 * configurations. validateEnvironment() reads process.env at call time (not
 * module-load time), so this can exercise several scenarios in one process
 * by mutating process.env between calls — no subprocess spawning needed.
 *
 * Run with:
 *   PowerShell: $env:NODE_OPTIONS = "--require ./scripts/_server-only-shim.cjs"; npx tsx scripts/verify-phase10-env-check.ts
 */
import { validateEnvironment } from "../src/lib/env-check";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const original = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, original);
  }
}

function throws(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

console.log("Case: missing DATABASE_URL");
withEnv({ NODE_ENV: "development", AUTH_SECRET: "a".repeat(40) }, () => {
  const err = throws(validateEnvironment);
  assert(err !== null && err.includes("DATABASE_URL"), "throws when DATABASE_URL is missing");
});

console.log("Case: placeholder AUTH_SECRET");
withEnv(
  {
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://localhost/db",
    AUTH_SECRET: "replace-with-a-long-random-value",
  },
  () => {
    const err = throws(validateEnvironment);
    assert(err !== null && err.includes("placeholder"), "throws when AUTH_SECRET is still the .env.example placeholder");
  }
);

console.log("Case: production pointed at localhost DATABASE_URL");
withEnv(
  {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://localhost:5432/db",
    AUTH_SECRET: "a".repeat(40),
    NEXT_PUBLIC_APP_URL: "https://example.com",
  },
  () => {
    const err = throws(validateEnvironment);
    assert(err !== null && err.includes("localhost"), "throws when NODE_ENV=production but DATABASE_URL is localhost");
  }
);

console.log("Case: production pointed at localhost APP URL");
withEnv(
  {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pw@ep-xyz.neon.tech:5432/db",
    AUTH_SECRET: "a".repeat(40),
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
  () => {
    const err = throws(validateEnvironment);
    assert(err !== null && err.includes("NEXT_PUBLIC_APP_URL"), "throws when NODE_ENV=production but the public app URL is localhost");
  }
);

console.log("Case: normal local dev config passes silently");
withEnv(
  {
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://postgres:pw@localhost:5432/car_marketplace",
    AUTH_SECRET: "a".repeat(40),
  },
  () => {
    const err = throws(validateEnvironment);
    assert(err === null, "a normal local dev config does not throw");
  }
);

console.log("Case: valid production config passes");
withEnv(
  {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pw@ep-xyz.neon.tech:5432/db",
    AUTH_SECRET: "a".repeat(40),
    NEXT_PUBLIC_APP_URL: "https://carmarketplace.co.ke",
    AUTH_URL: "https://carmarketplace.co.ke",
  },
  () => {
    const err = throws(validateEnvironment);
    assert(err === null, "a plausible production config does not throw");
  }
);

console.log("\nAll env-check assertions passed.");

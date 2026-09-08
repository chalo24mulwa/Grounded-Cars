# Deployment, Environments & Release Process (Phase 10)

Companion to `docs/backup-and-recovery.md` (backup/restore/rollback) and
`docs/architecture.md` (system design). This document covers environment
separation, monitoring, the pre-launch checklist, and the release process
itself.

## 1. Environment strategy

Three environments, never sharing a database:

| Environment | Purpose | Database | `NODE_ENV` |
|---|---|---|---|
| Local development | Individual dev work on a laptop | Local Postgres (or a personal Neon branch) | `development` |
| Staging | Pre-production verification of a release candidate | A separate managed Postgres instance/branch — **never** the production database | `production`* |
| Production | Real users, real payments | The production managed Postgres instance | `production` |

\* Staging should run with `NODE_ENV=production` (a real production build,
`next build && next start`) so what's being verified is the actual
production code path — a `next dev` staging environment would be testing a
different runtime than what ships.

**How this app enforces separation, not just documents it** (Phase 10 addition):

- `src/lib/env-check.ts`, run once at boot from `instrumentation.ts`,
  **refuses to start** if `NODE_ENV=production` and `DATABASE_URL` (or
  `NEXT_PUBLIC_APP_URL`/`AUTH_URL`) points at `localhost` — the exact
  "staging/dev config accidentally deployed as production" mistake this
  phase's spec calls out. This was verified live: running `next start`
  (a real production boot) against this repo's local `.env` fails fast with
  that exact error, before serving a single request.
  Verify yourself: `npx tsx scripts/verify-phase10-env-check.ts` runs the
  same logic against six scenarios in isolation (see that script's header
  for the exact invocation).
  It also warns (never blocks — see the module's own comments for why) when
  a non-production environment's `DATABASE_URL` looks like it might
  actually be a production host, covering the inverse mistake.
- Each environment gets **its own `.env`**, populated via the hosting
  platform's secret manager in staging/production — never a committed
  file, never copy-pasted between environments. `.env.example` (kept
  accurate — see below) is the only version-controlled reference for what
  variables exist.
- `DIRECT_DATABASE_URL` vs `DATABASE_URL`: local dev can leave these
  identical (no pooler in front of a local Postgres); staging and
  production should use a pooled `DATABASE_URL` (e.g. Neon's pooler) and a
  separate direct connection for `prisma migrate` — see `.env.example`'s
  own comments.

**Keeping `.env.example` accurate**: every time a new environment variable
is added anywhere in `src/`, add it to `.env.example` in the same change —
this file is the single source of truth for "what does this app need to
run," and it has been kept current through every phase of this project
(verify with `diff <(grep -oP '^\w+' .env.example | sort) <(grep -oP '^\w+' .env | sort)`
— should show only comment-line noise, no missing keys either direction).

**Never commit real secrets**: `.env` is git-ignored (see `.gitignore`).
Before any commit, run `git status` and look for `.env` specifically — if
it ever appears staged, unstage it and double-check `.gitignore` wasn't
accidentally edited.

## 2. Monitoring & logging

**Current state**: every unexpected error in a server action or service
call is caught by that layer's `toUserSafeError()` function (one per
`*-actions.ts` file), which does exactly two things — `console.error()`
the full error server-side, and return a generic, safe message to the
client. This is consistent across the entire app (auth, listings,
inquiries, featured, admin, notifications, favorites — verified by
grepping every `console.error` call site for this phase's audit; none log
a raw secret, password, or token — see the "no secrets in logs" check
below). `src/app/error.tsx` and `src/app/global-error.tsx` (Phase 9) are
the two React error boundaries; `not-found.tsx` handles missing
pages/`notFound()` calls; the M-Pesa webhook and cron routes log
`console.warn`/`console.error` on rejected/failed requests without ever
logging the secret token itself.

**What "logs must not contain secrets" means here, verified**: grepped
every `console.*` call in `src/` — none interpolate `process.env.*`
directly, none log a request body wholesale (each service picks specific,
already-non-secret fields to log), none log `passwordHash`, a raw
M-Pesa/cron bearer token, or `AUTH_SECRET`. The one email-related log line
(`lib/email.ts`'s console provider) logs the outgoing email's subject/body
— which in dev mode includes a password-reset link — but only when
`EMAIL_PROVIDER=console`, i.e. only in an environment that has no real
email provider configured yet; once `EMAIL_PROVIDER=resend` is set, that
code path stops running entirely and reset links are only ever delivered
by real email, never logged.

**What's NOT yet wired up** (this app has zero third-party dependencies
installed for this — deliberately, since none were requested and adding
one means picking a paid vendor and providing real credentials, which
wasn't done this phase): an error-tracking/APM service (Sentry, or
similar) that aggregates, alerts on, and gives stack traces for production
errors beyond what `console.error` + the hosting platform's own log
viewer provides. **Before real production launch**, wire one in — every
existing `console.error(...)` call site is already the exact place a
`Sentry.captureException(error)` (or equivalent) call would go, so this is
additive, not a refactor. Recommended minimum coverage once chosen:

- Every `toUserSafeError()` catch-all branch (already logs — add the
  APM call alongside).
- `expiry-service.ts`'s two `.catch()` handlers (a silently-failing
  background sweep is exactly the kind of failure a log line alone won't
  surface fast enough — Phase 10's "failed background jobs" monitoring
  requirement).
- `notification-service.ts`'s `notify()` catch block (a silently-failing
  notification/email).
- `lib/storage.ts`'s image-delete failure log (not urgent — non-fatal by
  design — but worth including for completeness).
- The M-Pesa webhook route's `catch` (a failed payment-callback
  processing) and its two `console.warn` rejection paths — **failed
  payments are the single highest-priority thing to alert on** before
  going live with real money.

**Database connectivity failures**: Prisma throws on connection loss; those
errors already flow through the same `toUserSafeError()` paths (an
unexpected error → generic message to the user, full error logged
server-side) — no special-casing needed, but they're exactly the kind of
error an APM tool's alerting should be tuned to page on immediately (not
just log), since they mean the whole app is down for every user
simultaneously, not one request failing.

## 3. Pre-launch deployment checklist

Status as of this phase, for **this specific codebase** — not a generic
checklist. Each item is one of: ✅ Done, ⚠️ Ready but needs a real
credential/decision only the business can provide, or ❌ Not started.

| Item | Status | Notes |
|---|---|---|
| Production database configured | ⚠️ | Schema/migrations are production-ready; needs a real managed Postgres instance provisioned (Neon recommended per `architecture.md`) |
| Database backup completed | ⚠️ | Procedure documented (`backup-and-recovery.md`); needs to actually be run once a real production DB exists |
| Environment variables configured | ⚠️ | `.env.example` is complete and accurate; production values need to be entered into the hosting platform's secret manager |
| Authentication configured | ✅ | Auth.js + Credentials provider fully built and tested; `AUTH_SECRET` just needs a real generated value in production (`env-check.ts` refuses the placeholder) |
| Secure HTTPS configured | ⚠️ | App-level: none of the app's own logic assumes HTTP (cookies aren't set `secure: false`, no hardcoded `http://`) — HTTPS itself is a hosting-platform/DNS/certificate concern outside this codebase |
| Image storage configured | ⚠️ | Local-disk storage works today (persistent-filesystem hosts only — see README's Known Limitations); migrating to R2/B2/S3 before launch is strongly recommended if the host is ephemeral/serverless |
| Payment provider configured | ❌ | M-Pesa Daraja needs real Till number + credentials from Safaricom — everything else (webhook, activation logic, idempotency) is built and tested via the dev simulator |
| Webhooks configured and verified | ⚠️ | Webhook route is built, secured (secret token), and idempotency-tested (this phase: duplicate delivery verified as a true no-op); needs the real Daraja callback URL registered once Till number is live |
| Scheduled jobs configured | ✅ | In-process hourly sweep + external cron trigger both built and tested |
| Email provider configured | ❌ | Defaults to console-logging; needs `RESEND_API_KEY`/`EMAIL_FROM` (or another provider) before launch, or password resets/notifications are undeliverable |
| SEO configuration active | ✅ | `generateMetadata`, JSON-LD, canonical URLs (Phase 9) |
| Sitemap generated | ✅ | `src/app/sitemap.ts`, verified live |
| Error monitoring active | ❌ | No APM/error-tracking service installed yet — see Monitoring section above |
| Production migrations tested | ✅ | All migrations reviewed this phase (see below); every one is additive |
| No test secrets remain | ✅ | Verified: no hardcoded credentials/API keys in `src/`; `.env` (with dev-only values) is git-ignored |
| No development-only admin bypass exists | ✅ | Every `NODE_ENV`-gated code path audited this phase (6 total) — all correctly hard-blocked server-side in production, not just UI-hidden |

**Blockers for a real production launch**: payment provider credentials,
email provider credentials, HTTPS/hosting setup, and installing an
error-monitoring service. All four are business/infrastructure decisions
requiring real-world resources this session doesn't have — not application
defects. Everything else in this table is genuinely ready.

## 4. Database migration review (this phase)

Every migration in `prisma/migrations/` was reviewed for the release-safety
criteria this phase asks for:

- **Additive only.** No migration in this project's history contains a
  destructive `DROP TABLE`, `DROP COLUMN` (on real data), or `TRUNCATE`.
  Every schema change is a new table, a new nullable/defaulted column, or
  (the one recurring exception, always deliberate) a `NOT NULL` column
  added via the add-nullable → backfill → constrain sequence, documented
  in-line in the migration file each time it's used.
- **Data-preserving.** The most recent example (Phase 8's
  `title`/`message` columns on `Notification`) was verified end-to-end:
  backfilled all 4 pre-existing rows correctly before constraining, with a
  live query confirming the exact backfilled values.
- **Rollback plan**: see `backup-and-recovery.md` section 5 — this
  project's migrations are forward-only by convention; a bad migration is
  corrected with a new forward migration, or (for a genuinely catastrophic
  case) a restore from the pre-migration backup, never an edit to an
  already-applied migration file.
- **Staging test requirement**: before any production `prisma migrate
  deploy`, run the identical command against staging first, using a
  staging database that is a real (if smaller/anonymized) copy of
  production's schema — not just "it worked on my laptop." This project
  doesn't yet have a staging database provisioned (see checklist above),
  so this step is a process requirement for whoever runs the first real
  deploy, not something verified this phase.

## 5. Release process

1. **Commit working code.** Every change reviewed, tests/checks below
   green, nothing uncommitted.
2. **Run automated checks.** `npm run typecheck` and `npm run build` must
   both pass cleanly (no errors; the one pre-existing Edge Runtime warning
   from `next-auth`'s `jose` dependency is expected and harmless — it's
   about a code path this app's Node-runtime-only Auth config never
   exercises).
3. **Deploy to staging.** A real `next build` + `next start` (or the
   hosting platform's equivalent), pointed at the staging database,
   staging M-Pesa sandbox credentials, and a staging `NEXT_PUBLIC_APP_URL`.
4. **Run complete staging tests.** The full buyer/seller/admin journey
   this phase exercised against local dev (see the Phase 10 report) should
   be re-run against staging before every production release — a
   regression that only appears under a real production build (this phase
   found one category of exactly that: `NODE_ENV=production` behavior
   differs from `next dev`, see the env-check discovery above) won't show
   up in local dev testing alone.
5. **Back up production** (`backup-and-recovery.md` section 1) —
   especially before step 6.
6. **Apply reviewed migrations** (`prisma migrate deploy` against
   production) — only migrations already applied and verified on staging
   in step 3/4.
7. **Deploy production application code.**
8. **Run production smoke tests** — see section 6 below.
9. **Monitor immediately after launch** — watch error rates/logs
   actively for at least the first hour, not just "check back tomorrow."

**Never combine database experimentation with a live production deployment**
— any exploratory migration, data-repair query, or schema idea gets tried
against a disposable/staging database first, always. This project's whole
migration history (every phase) already follows a stricter version of this
rule: even *reviewed, ready* migrations go through `--create-only` +
manual inspection of the generated SQL before ever being applied anywhere.

## 6. Post-launch smoke tests

Run these against the real production URL immediately after every deploy —
this is the literal checklist, each one already verified against this
codebase in local testing this phase (see the Phase 10 report for what
"verified" means for each):

- [ ] Homepage loads (`/` → redirects to `/cars`)
- [ ] Search works (`/cars?q=...` returns filtered results)
- [ ] Registration works (new account created, auto-logged-in, correct
      BUYER role)
- [ ] Login works (existing account, correct role-based redirect)
- [ ] Seller can view/manage their cars (`/dashboard/listings`)
- [ ] Images load (both the grid thumbnails and a detail page's gallery)
- [ ] SOLD badge renders correctly on a sold listing
- [ ] Featured listings appear on `/best-deals` and show the Verified badge
- [ ] A real payment (small test amount, real Till number) verifies
      correctly end-to-end — **do this deliberately once, watched closely,
      before trusting the payment path with real customer traffic**
- [ ] Notifications are being created (check the database directly, since
      no inbox UI exists yet — see README's Known Limitations)
- [ ] Admin routes are unreachable by a non-admin account, and reachable
      by the real admin account

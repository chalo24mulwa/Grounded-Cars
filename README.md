# Car Marketplace

Production-track online car marketplace, Kenya-first. Beyond the numbered phases: a rebranded color palette blended from the logo, an animated hero banner, an "Our Services" section, and an admin-managed Events feature — see "Site Content & Branding" below. Phases 1–10 are complete: architecture/database foundation, authentication & role-based access, the seller dashboard with listing management and the SOLD workflow, featured-listing subscriptions paid via M-Pesa STK Push, server-side search/filter/sort/pagination on the public marketplace, buyer favorites + a secure seller inquiry system, a secure admin dashboard for listing moderation/user management/audit logging, a provider-agnostic notification + email architecture with idempotent subscription-expiry reminders, a security/performance/SEO hardening pass, and a full release-readiness pass (environment safety checks, end-to-end journey testing, payment idempotency verification). See `docs/architecture.md` for the phased roadmap, `docs/backup-and-recovery.md` for operational recovery procedures, and `docs/deployment.md` for environment strategy, the pre-launch checklist, and the release process.

## Stack

Next.js (App Router) · TypeScript (strict) · PostgreSQL · Prisma · Tailwind CSS · Auth.js (NextAuth v5, Credentials provider + Prisma adapter)

## Prerequisites

- Node.js 18.18+
- A PostgreSQL database (local, or a managed provider like Neon/Supabase — see `docs/architecture.md` re: Namecheap Stellar Plus hosting notes)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env with your real DATABASE_URL, DIRECT_DATABASE_URL, and AUTH_SECRET
# generate AUTH_SECRET with: npx auth secret

# 3. Validate the schema (do this first — catches typos before touching the DB)
npx prisma validate

# 4. Run migrations (creates/updates all tables in your dev database)
npm run db:migrate:dev

# 5. (Optional) Seed sample data — a seller, buyer, admin, and one listing
npm run db:seed

# 6. Type-check the project
npm run typecheck

# 6b. (Optional) Verify background-job idempotency (Phase 8) — needs a small
# module-resolution shim since it imports real service files outside Next's
# own bundler; see the script's own header comment for why.
# PowerShell: $env:NODE_OPTIONS = "--require ./scripts/_server-only-shim.cjs"; npx tsx scripts/verify-phase8-idempotency.ts
# bash:       NODE_OPTIONS="--require ./scripts/_server-only-shim.cjs" npx tsx scripts/verify-phase8-idempotency.ts

# 7. Start the dev server
npm run dev
```

Visit `http://localhost:3000/cars` to see the public listing grid, or `/register` to create an account.

Seed accounts (all password `Password123!`):
- `seller@example.com` — SELLER role, owns one seeded listing
- `buyer@example.com` — BUYER role
- `admin@example.com` — ADMIN role, moderates listings and manages users at `/admin`

Seed also creates three `FeaturedPlan` rows (3/7/30-day boosts). To buy a
feature, sign in as the seller and go to Dashboard → Featured Listings. Real
M-Pesa payment requires the env vars below; without them (any non-production
environment) the flow still works end-to-end using `[DEV] Simulate success /
failure` buttons in place of a real STK Push callback — see "M-Pesa & Featured
Listings" below.

## Project Structure

See `docs/architecture.md` for the full explanation. Short version:

```
prisma/schema.prisma        → single source of truth for the database
src/app/                    → routes (public, auth, account, seller dashboard, admin — route groups)
src/middleware.ts           → Edge-safe route protection for /account, /dashboard, /admin
src/server/services/        → ALL business logic lives here
src/server/authorization/   → ALL ownership/role checks live here
src/server/validation/      → ALL zod schemas (shared client+server)
src/server/actions/         → thin server actions that call services
src/components/             → UI only, no business logic
src/config/site.ts          → site name, contact number, logo paths (no secrets)
src/lib/storage.ts          → local-disk image storage (swappable for S3/R2 later)
src/lib/mpesa.ts            → M-Pesa Daraja STK Push client (only module that calls Safaricom)
src/instrumentation.ts      → starts the hourly expiry/auto-archive sweep on server boot
src/server/validation/search-schema.ts → safe URL searchParams → typed filter parsing
src/server/services/notification-service.ts → the Notification write path (no UI/delivery yet — see below)
src/server/services/audit-service.ts → the AuditLog write/read path for sensitive admin actions
src/server/services/notification-service.ts → notify() — the single write path for every notification + notification email
src/lib/email.ts → provider-agnostic email sending (console/Resend), never called directly except from here and password-reset-service.ts
src/lib/email-templates.ts → the one reusable HTML/text email template every notification email renders through
scripts/verify-phase8-idempotency.ts → standalone concurrency test for background-job idempotency (see its own header for how to run it)
scripts/verify-phase9-security.ts → standalone test for image-upload magic-byte validation (see its own header)
src/app/robots.ts, src/app/sitemap.ts → SEO crawl directives + sitemap (Next.js file conventions)
src/app/not-found.tsx, src/app/global-error.tsx → branded 404 and root-layout-level error boundary
docs/backup-and-recovery.md → database/image/environment backup, restore, and rollback procedures
docs/deployment.md → environment strategy, deployment checklist, release process, post-launch smoke tests
src/lib/env-check.ts → boot-time environment validation (refuses to start with a broken/mismatched-environment config)
scripts/verify-phase10-env-check.ts → standalone test of env-check.ts's scenarios (see its own header)
scripts/verify-event-image.ts → standalone test of event image storage (see its own header)
src/server/services/event-service.ts, src/server/actions/event-actions.ts → the Event write/read path (admin-only mutations, public read)
src/components/layout/HeroBanner.tsx, OurServicesDropdown.tsx → the /cars hero and header services dropdown
src/components/services/ServicePageLayout.tsx → shared layout for the five /services/* pages
public/brand/                → logo source files (colored + transparent, SVG/PNG)
public/uploads/               → seller-uploaded listing images (git-ignored)
```

## Branding

Site identity (name, contact number, WhatsApp number, logo paths) is centralized in `src/config/site.ts`. Logo assets live in `public/brand/`; `src/app/icon.png` is Next.js's App Router auto-favicon convention. A floating WhatsApp chat button (`src/components/layout/WhatsAppButton.tsx`) appears on every page, bottom-right.

## M-Pesa & Featured Listings

Featured-listing payment uses M-Pesa Daraja STK Push (Buy Goods / Till number — not Paybill). Real payment requires five env vars: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_TILL_NUMBER`, `MPESA_PASSKEY`, `MPESA_CALLBACK_SECRET` (the last is generated locally, not from Safaricom — see `.env.example`). Until the Till number is available, `isMpesaConfigured()` returns false and:
- In production, starting a feature purchase fails with a clear "not set up yet" message — nothing is silently faked.
- In any other environment, `startFeatureSubscription()` synthesizes a request id instead of calling Safaricom, so the whole PENDING → paid → ACTIVE path is testable via the `[DEV] Simulate success/failure` buttons on Dashboard → Featured Listings. This code path is hard-blocked by `NODE_ENV === "production"`, not just hidden in the UI.

"Is this listing featured" is **never** a stored boolean — every read (`getPublicListings`, `getPublicListingBySlug`, Best Deals) re-derives it live from `FeaturedSubscription.status === "ACTIVE" AND expiresAt > now() AND the listing's own status === "ACTIVE"`. A listing marked SOLD loses its Verified badge and featured placement immediately, regardless of remaining subscription time.

## Favorites, Inquiries & Notifications

Favorites (`Favorite`, Phase 1 schema) let any signed-in user save a listing — duplicate-safe via a DB unique constraint (`(userId, listingId)`), not application-level checking. Inquiries let a signed-in user message a seller about one of their ACTIVE listings; every identity field on the `Inquiry` row (`buyerUserId`, `sellerId`, and a `name`/`email`/`phone` snapshot) is server-derived from the session and the listing itself — the client only ever supplies `message`. A buyer can have at most one open (NEW/READ) inquiry per listing at a time, and inquiry submissions are rate-limited per user.

Notifications (`Notification`, Phase 1 schema) get a real row written at four points — new inquiry (seller), inquiry marked replied (buyer), a favorited listing marked SOLD (every user who favorited it), and a featured subscription expiring (seller) — but there is deliberately no inbox UI, read/unread indicator, or email/push delivery yet; that's the "prepare the structure, don't overbuild the system" line from the spec. `readAt` already exists on the table for whenever that UI is built.

## Notifications, Email & Subscription Reminders

`notify()` in `src/server/services/notification-service.ts` is the single entry point for every marketplace-event notification — no other file writes a `Notification` row or calls the email service directly. It's called after (never inside) the real database transaction it reports on, and it never throws, so a broken notification/email path can never roll back or corrupt a real state change.

- **Two channels per event, each independently preference-gated.** In-app (a `Notification` row: `type`, `title`, `message`, `relatedEntityType`/`relatedEntityId`, `payload`, `readAt`) and email (via `src/lib/email.ts`). `NotificationPreference` (one row per user, `emailEnabled`/`inAppEnabled`, default both `true`, no row needed until a user changes something) gates non-essential types on both channels. `REQUIRED_TYPES` in notification-service.ts (`ACCOUNT_STATUS_CHANGED`, `PAYMENT_FAILED`) always fire on both channels regardless of preference — the "do not prevent legally/operationally necessary notifications" rule from the spec, enforced in code, not by convention.
- **One copy source, `NOTIFICATION_COPY`.** Every type's title/message (and email CTA) is generated in exactly one place, so the in-app row and the email always say the same thing, and a future UI never needs its own per-type rendering logic. Eleven event types are wired to real call sites today: `INQUIRY_RECEIVED`/`INQUIRY_REPLIED` (inquiry-service.ts), `LISTING_APPROVED`/`LISTING_REJECTED`/`LISTING_SOLD`/`FAVORITE_LISTING_SOLD` (listing-service.ts's `changeListingStatus`, detected by which status edge fired), `SUBSCRIPTION_ACTIVATED`/`PAYMENT_FAILED` (featured-service.ts's `handleMpesaCallback`), `SUBSCRIPTION_EXPIRING_SOON`/`SUBSCRIPTION_EXPIRED` (expiry-service.ts's sweep), and `ACCOUNT_STATUS_CHANGED` (admin-service.ts's `setUserStatus`).
- **Email is provider-agnostic** (`src/lib/email.ts`, mirroring how `lib/mpesa.ts` owns all Safaricom calls and `lib/storage.ts` owns all file writes — one module per external integration). `EMAIL_PROVIDER=console` (the default, and what every environment uses today — no real provider is chosen yet) logs the email instead of sending it; `EMAIL_PROVIDER=resend` makes a real HTTP call via plain `fetch` (no SDK dependency, same pattern as `mpesa.ts`) using `RESEND_API_KEY`/`EMAIL_FROM`. `sendEmail()` never throws — a misconfigured or down provider is logged and reported back as `{ sent: false }`, nothing more. Templates are one reusable HTML/text builder (`src/lib/email-templates.ts`'s `buildNotificationEmail`) parameterized by title/message/CTA, not a bespoke design per event; user-authored text (a listing title, an admin's rejection reason) is HTML-escaped before interpolation. Password-reset emails (Phase 2) now go through this same service — see `password-reset-service.ts` — though deliberately outside `notify()`, since a password reset isn't a preference-gateable marketplace event.
- **Subscription expiry reminders (7/3/1 days before `expiresAt`, plus the expiry notification itself)** are folded into the existing hourly sweep (`runExpirySweep()` in `expiry-service.ts`) rather than a second scheduler — hourly resolution is more than enough for day-granularity reminders, and it reuses the same in-process-timer + external-cron-trigger reliability story Phase 4 already built.
- **Idempotency is enforced at the database level, not by an app-level check-then-act.** Two mechanisms, chosen per what's actually being guarded:
  - **Status flips** (subscription → EXPIRED, listing SOLD → ARCHIVED): every write is a conditional `updateMany({ where: { id, status: <expected current status> } })`. Only the caller whose update actually matches a row (`count === 1`) sends the notification; a concurrent or retried sweep finds the row already changed and its own update matches zero rows — no duplicate notification, no duplicate history row. This is real Postgres row-level locking doing the work, not an in-process mutex (which wouldn't help across two processes or an external cron trigger overlapping the in-process timer anyway).
  - **Reminders** (the subscription's own status doesn't change at the 7/3/1-day mark, so there's no status flip to guard on): a dedicated `SubscriptionReminder` table with a `@@unique([subscriptionId, reminderType])` constraint. The sweep always tries to `create()` the claim row first; a unique-constraint violation (Prisma `P2002`) means another run already claimed and sent that exact reminder, so it's caught and skipped, never retried.
- **One migration this phase** (`prisma/migrations/20260829212504_phase8_notifications_email_reminders`): `Notification` gained `title`/`message`/`relatedEntityType`/`relatedEntityId`; two new tables, `notification_preferences` and `subscription_reminders`. `title`/`message` are `NOT NULL` but the table already had rows — hand-edited from Prisma's draft into the standard "add nullable → backfill from existing `type` → constrain `NOT NULL`" three-step sequence (see the migration's own header comment), the safe way to add a required column to a non-empty table without inventing a meaningless shared default.
- **User preferences** are prepared for future expansion (`getMyNotificationPreference`/`updateMyNotificationPreference`, plus thin `src/server/actions/notification-actions.ts` wrappers) even though no settings UI exists yet — matching the spec's "prepare the architecture" instruction and this project's repeated "don't overbuild the UI" precedent. `getMyNotifications`/`markNotificationRead` never accept a `userId` parameter from the caller — they always resolve the current user via `requireAuth()`, so there is no argument to tamper with to read or modify someone else's notifications.

## Site Content & Branding

Post-launch additions, not tied to a numbered phase:

- **Color palette** (`tailwind.config.ts`) — three tones lifted directly from the actual logo mark's own gradient (see `public/brand/logo-colored.svg`'s fill values: green → gold/olive → orange) and blended toward neutral gray, rather than used at the logo's full saturation. `brand` (deep forest green), `brand-accent` (muted terracotta), `brand-gold` (muted gold). `brand`/`text-brand` were already used ~120 places across the app, so the whole site picked up the refined tone automatically; the Featured/Verified badge now gradients gold→terracotta as a direct echo of the logo's own color sweep.
- **`HeroBanner`** (`src/components/layout/HeroBanner.tsx`) — sits at the top of `/cars` (the app's de facto landing page — `/` redirects there). No video file exists in the project, so this is a small fleet of car silhouettes genuinely driving across an animated road strip using pure CSS `transform`/`background-position` keyframes (`tailwind.config.ts`'s `drive`/`road-lines`) — no JS, no download, never buffers. Verified live that positions actually change between two screenshots a couple seconds apart. CTA is session-aware (mirrors SiteHeader/SiteFooter): "Start Selling" for a logged-out visitor, "Become a Seller" for a buyer, "List a Car" for an existing seller/admin.
- **`SiteFooter`** (`src/components/layout/SiteFooter.tsx`) — mounted once in the root layout, so it's present on every page. Session-aware quick-link columns: Marketplace, Our Services, Account (adapts to logged-in/out and role), Contact.
- **Header order** (`src/components/layout/SiteHeader.tsx`) — Home, Best Deals, Our Services (dropdown), Events, then either Log in/Register or the authenticated links (Favorites, Account, Dashboard, Admin, Log out), matching the requested nav structure. The "Our Services" dropdown (`OurServicesDropdown.tsx`) uses the same zero-JS native `<details>`/`<summary>` disclosure pattern already established for the mobile filter accordion on `/cars` — keyboard-accessible, no client-side hydration needed just to open a menu.
- **"Our Services" pages** (`src/app/(public)/services/*`) — five informational/lead-generation pages (Pre-Purchase Inspection, Car Financing, Car Valuation, Car Tracking, Home Repairs), sharing one layout component (`src/components/services/ServicePageLayout.tsx`). These are content pages with a WhatsApp/phone contact CTA pre-filled with which service the visitor is asking about — deliberately **not** standalone transactional systems (no financing application flow, no live GPS map); building those would be a materially larger, separately-scoped feature. Each inquiry routes through the same contact channel already used site-wide.
- **Events** (new `Event` model + `event-service.ts`/`event-actions.ts`) — admin-only content management (`/admin/events`, `/admin/events/new`, `/admin/events/[id]/edit`), public listing and detail pages (`/events`, `/events/[id]`). `published` (default `false`) is the only lifecycle control — same "never delete a row a human created" convention as every other content type in this app; an admin unpublishes an event rather than removing it. Images go through the same magic-byte/size validation as listing photos (`saveEventImage` in `storage.ts`, factored out of `saveListingImage`'s shared validation), stored under `public/uploads/events/`. Verified end-to-end: event creation, the publish toggle, the public listing/detail pages, non-admin access correctly blocked, and (via a standalone script, since a browser-automation limitation prevented testing native `<form>` file submission directly — see `scripts/verify-event-image.ts`) that `saveEventImage`/`deleteEventImage` correctly write and remove real files on disk.
- Both the sitemap and the site footer were updated to include every new public page.

## Release Readiness (Phase 10)

A full pre-launch pass: environment safety, end-to-end functional testing of all three user journeys, database migration review, and payment-idempotency verification. See `docs/deployment.md` for the complete environment strategy, deployment checklist, and release process — summary of what's new here:

- **`src/lib/env-check.ts`** (new) — runs once at boot (`instrumentation.ts`) and refuses to start if `NODE_ENV=production` points at what looks like a localhost database or app URL, or if `AUTH_SECRET` is still the `.env.example` placeholder. This isn't hypothetical: running a real `next build && next start` against this repo's own dev `.env` was used to verify it, live, in this phase — it correctly refused to boot with the exact "looks like a dev config deployed as production" error. Six scenarios (missing DB URL, placeholder secret, prod-pointed-at-localhost ×2, valid dev, valid prod) are covered in `scripts/verify-phase10-env-check.ts`.
- **Full buyer/seller/admin journeys re-verified end-to-end** against the current, fully-integrated codebase (not individually per-phase, as before) — a fresh registration through search/filter/favorite/inquiry as buyer; a full listing lifecycle (create → real image upload → edit → submit → admin-approve → mark SOLD → confirm the green badge → restore → feature → verify placement → verify expiry) as seller; audit-log and subscription review as admin. One real image (magic-byte-valid JPEG) was uploaded and served through the actual storage pipeline, not just asserted against in isolation.
- **Duplicate M-Pesa webhook delivery verified against the real route**, not just code-reviewed: the identical callback payload was POSTed twice to `/api/webhooks/payments` with a real `CheckoutRequestID` — confirmed exactly one `SUCCESS` payment, one `ACTIVE` subscription, and one `SUBSCRIPTION_ACTIVATED` notification resulted, proving the existing idempotency guarantee holds under an actual duplicate request, not just in theory.
- **No development-only admin bypass** — every `NODE_ENV`-gated code path in the app (6 total) was catalogued and confirmed server-side-enforced, not just UI-hidden.
- **`docs/deployment.md`** (new) — environment strategy, a per-item deployment-readiness status table (what's done vs. what needs real credentials only the business can provide), migration review, the release process, and the post-launch smoke-test checklist.

## Security, Performance & SEO Hardening (Phase 9)

A structured audit across auth, authorization, file uploads, payments, queries, and SEO, followed by targeted fixes — deliberately not a redesign (per the phase's own instruction). Full findings/fixes are in the Phase 9 report; summary of what changed:

- **Security headers** (`next.config.mjs`'s `headers()`) apply to every response, including static assets under `/uploads`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. A full CSP was considered and deliberately deferred — see Known Limitations.
- **Image upload hardening** (`src/lib/storage.ts`): magic-byte signature validation for JPEG/PNG/WebP (a browser-declared `file.type` was previously trusted as-is; now the actual file bytes must match too) on top of the existing size cap, plus a new `MAX_IMAGES_PER_LISTING` (12) cap enforced in `addListingImage()`.
- **New rate limits** (reusing the existing `checkRateLimit` primitive from Phase 2/6, not a new mechanism): listing creation, image uploads, and featured-subscription purchase attempts are all now bounded per user per hour — previously only auth and inquiries were.
- **Seller dashboard performance fix**: `/dashboard`'s overview stats previously called `getMyListings()` (every listing, every image, included) just to compute five counts and a view-count sum in JS. Replaced with `getSellerDashboardStats()` — a `groupBy` + `aggregate`, touching zero `CarImage` rows.
- **SEO**: `cars/[slug]/page.tsx` gained `generateMetadata` — unique title/description generated from real listing data, canonical URL, Open Graph + Twitter Card tags, and JSON-LD (`schema.org/Vehicle` + `Offer`). A SOLD listing's metadata never claims "for sale" and is marked `noindex` + `OutOfStock` — never misleading. `src/app/robots.ts` and `src/app/sitemap.ts` are new (previously neither existed); `metadataBase` was added to the root layout so relative OG/canonical URLs resolve correctly.
- **A real bug caught during Phase 9's own testing, not shipped**: adding `generateMetadata` alongside the existing page component meant `getPublicListingBySlug()` — which increments `viewCount` as a side effect — ran twice per page view. Fixed by wrapping it in React's `cache()`, which de-dupes both calls (metadata + page) into one DB round trip per request; verified live that a single page view increments the count by exactly 1, not 2.
- **Error handling**: added `src/app/not-found.tsx` (branded 404 — previously Next's default unstyled page) and `src/app/global-error.tsx` (catches errors thrown by the root layout itself, which the existing `error.tsx` cannot). `error.tsx` now surfaces `error.digest` as a support-reference id instead of ever printing a raw error message for anything other than the one known, already-safe `AccountSuspendedError` case.
- **`docs/backup-and-recovery.md`** (new) — database backup/restore, local-disk image storage recovery, environment-variable recovery, and migration/deploy rollback strategy. Documentation only; no destructive restore was run against real data.

## Admin Dashboard, Moderation & Audit Log

Every `/admin*` route sits in the `(admin)` route group, whose layout (`src/app/(admin)/layout.tsx`) redirects anyone who isn't signed in as `ADMIN` — the same pattern `(seller)/layout.tsx` already used. That layout check is defense-in-depth only: every function in `admin-service.ts`, `listing-service.ts`, and `featured-service.ts` that an admin page calls independently calls `requireRole("ADMIN")` itself, so the data access is never actually gated by the layout or by `middleware.ts` alone — all three layers would have to fail for an unauthorized read/write to get through.

- **Listing moderation** (`/admin/listings`, plus the pending queue on `/admin`) — approve/reject/archive, never delete. Rejecting a `PENDING` listing requires a validated reason (10–1000 chars) and moves it back to `DRAFT`, not to a separate "rejected" state — the seller edits and resubmits the same row. The reason is stored in the existing `ListingStatusHistory.note` field (no new column) and surfaced back to the seller via `getLatestRejectionReason()` as a banner on their edit page. Archiving an already-`ACTIVE` listing for policy reasons (`archiveListingByAdmin`) is a distinct action from a seller's own archive, so the audit trail and the seller-facing note both make clear an admin acted, not the seller.
- **User management** (`/admin/users`) — filter/search by role and status; change a user's `UserStatus` (`ACTIVE`/`SUSPENDED`/`DEACTIVATED`) with an optional reason. No delete — this is deliberately the only "user management" action, matching the "no destructive deletion" rule that runs through every phase. An admin cannot change their own status (`setUserStatus` throws `AuthorizationError` if `targetUserId === admin.id`), so an admin can never accidentally or maliciously lock themselves out.
- **Suspension is enforced live, not just at login.** `requireAuth()` (`src/server/authorization/ownership.ts`) re-fetches the caller's `status` from the database on every call — not from the JWT, which is never revoked server-side — and throws `AccountSuspendedError` (a subclass of `AuthorizationError`, so every existing `toUserSafeError()` handles it with zero changes) if it isn't `ACTIVE`. That means a user suspended mid-session is blocked on their *very next* protected action, even though their session cookie is still cryptographically valid. `src/app/error.tsx` (new) renders a clean "Account suspended" message when that error reaches a page boundary instead of the generic error screen. Fresh login is blocked even earlier, at the Credentials `authorize()` step (`src/lib/auth.ts`), which already checked `user.status !== "ACTIVE"` before this phase.
- **Featured subscriptions view** (`/admin/subscriptions`) — read-only, by design: every `FeaturedSubscription` with its plan, buyer, listing, and full `PaymentTransaction` history, filterable by status. There is no edit action here — payment/subscription state only ever changes through the M-Pesa webhook or the expiry sweep, never a manual admin edit, so this page can't offer one.
- **Audit logging** (`/admin/audit-log`, backed by `audit-service.ts`) — every sensitized admin action (listing approved/rejected/archived, user status changed, featured plan created/status changed) writes one `AuditLog` row: actor, action, entity type/id, and a plain-JSON metadata blob containing only business facts (a reason string, an old/new status, a listing title) — never a password, token, or secret. The table already existed in `schema.prisma` since Phase 1 and was already written to once (`becomeSeller()`'s `ROLE_UPGRADED_TO_SELLER` entry); this phase is the first to write to it from the admin side. `actorUserId` is nullable with `onDelete: SetNull`, so a log entry survives even if the acting admin's account is later removed — the audit page shows "Unknown actor (account deleted)" rather than losing the row.
- **Zero new migrations.** `AuditLog` and `UserStatus` both already existed in the schema before this phase — moderation, user management, and audit logging are built entirely on tables and enums that were already there, just not yet wired up on the write side.

## Key Design Decisions

- **Role is never client-controlled.** Registration always creates a `BUYER`. The only path to `SELLER` is the authenticated, self-service "Become a seller" action (`becomeSeller()` in `auth-service.ts`) — no admin approval required for that. `ADMIN` is never self-serviceable.
- **Publishing a listing (first-time ACTIVE) requires admin approval.** Sellers submit DRAFT → PENDING; only an ADMIN can move PENDING → ACTIVE. Restoring a previously-sold listing (SOLD → ACTIVE) does **not** need re-approval — see `src/server/services/listing-status.ts` for the full, edge-by-edge transition/role table.
- **Ownership checks always re-query the database by ID from the session**, never trusting a `sellerId`/`listingId` supplied by the client. See `src/server/authorization/ownership.ts`.
- **The SOLD badge is 100% derived from `listing.status`.** No free-text field a seller can type into. Card thumbnails use a diagonal corner ribbon (`SoldRibbon.tsx`); the detail page uses a premium banner (`SoldBanner.tsx`).
- **Every status change is recorded in `ListingStatusHistory`**, an append-only audit table.
- **Listing images are local-disk files under `public/uploads/`** (see `src/lib/storage.ts`), referenced from Postgres only by URL — never stored as binary in the database. Filenames are random, never user-supplied. Swapping to S3-compatible object storage later means rewriting that one module only.
- **Session JWTs are refreshed in place** (`unstable_update()`) immediately after a role change (e.g. becoming a seller), so a user never has to log out/in again to access their new role's pages.
- **Renewing a featured listing creates a new `FeaturedSubscription` row rather than mutating the old one** — the UI's "Feature a car" form doubles as the renewal flow. This is what makes "view subscription history" a plain query with no separate history table needed.
- **Sold listings auto-archive 14 days after `soldAt`**, and expired featured subscriptions flip to `EXPIRED`, via one hourly in-process sweep (`src/server/services/expiry-service.ts`, started by `src/instrumentation.ts`) plus a bearer-token-protected `POST /api/cron/expiry` for an optional external trigger. Auto-archiving never deletes the row, its images, or its status history — it only changes `status`, exactly like a seller's own manual "Archive."
- **The M-Pesa webhook is matched to a purchase by `CheckoutRequestID`, never trusted blindly.** An unrecognized id is silently acknowledged and ignored (not applied); a second callback for an already-processed id is a no-op — this is what makes duplicate Daraja callbacks safe.
- **Search/filter parsing never fails atomically.** `parseListingSearchParams` (search-schema.ts) validates each URL param independently — one garbage value (bad enum, non-numeric price, an injection-flavored string) is silently dropped, every other valid filter still applies. Combined with Prisma's parameterized query builder (no raw SQL string-building anywhere in the search path), this is what actually prevents both crashes-on-bad-input and SQL injection — not input sanitization.
- **Featured-first is a fixed grouping, not a fixed order.** Every sort option (price, year, mileage, newest, oldest) is applied to *both* the featured and normal groups — only the featured-group-first placement itself is constant, because sellers pay specifically for top placement. Pagination is computed across the two groups without ever re-fetching or double-counting a row (see `getPublicListings` in `listing-service.ts`).
- **A SOLD listing accepts no new inquiries, full stop** — not hidden by CSS, the form simply isn't rendered server-side, and `createInquiry()` rejects a non-ACTIVE listing independently of what the UI shows. Existing inquiries on a listing that's since been marked SOLD remain untouched (never deleted or auto-closed).
- **`Inquiry.status` is a real Prisma enum now** (`NEW/READ/REPLIED/CLOSED`) — Phase 1 shipped it as a plain String specifically flagged "enum candidate later"; this is that later.

## Known Limitations

- Image storage is local disk, which requires persistent server storage (true for the documented Namecheap Stellar Plus target, **not** true for ephemeral/serverless hosts like Vercel). Migrate to R2/B2/S3 before deploying anywhere without a persistent filesystem.
- No real email provider is configured yet — `EMAIL_PROVIDER` defaults to `"console"` (logs instead of sending) in every environment today, including production, until `RESEND_API_KEY`/`EMAIL_FROM` are set and `EMAIL_PROVIDER=resend`. Password-reset links are also still shown directly in the UI when `NODE_ENV !== "production"`, in addition to the (currently console-logged) email.
- No notification bell/inbox or notification-preferences UI exists yet — the full service layer (`getMyNotifications`, `markNotificationRead`, `getMyNotificationPreference`/`updateMyNotificationPreference`) and its thin server actions are built and ownership-tested, but nothing in the app renders them. Deliberate scope cut, same "prepare the structure, don't overbuild the UI" pattern as Phase 6's notification-row-writing-with-no-inbox and Phase 7's audit-log-with-no-filtering-UI.
- Subscription-expiry reminders fire at 7/3/1 days regardless of how short a plan's duration is — a plan shorter than 7 days will send multiple reminders in quick succession the first time the sweep runs after purchase (e.g. a 3-day plan sends both the 7D and 3D reminder on its very first eligible sweep, since both thresholds are already satisfied). Not a bug for the seeded 3/7/30-day plans' realistic usage, just worth knowing if a much shorter plan is ever added.
- Rate limiting (login/register/password-reset) is an in-memory, per-process store — fine for a single Node process, but needs a shared store (Redis/Upstash) if the app is ever deployed across multiple instances.
- JWT sessions can't be server-revoked — after a password change, other already-logged-in devices stay valid until their token naturally expires.
- ESLint isn't configured in this project (`next lint` prompts interactively rather than running) — pre-existing gap, unrelated to any phase's functionality.
- "Total Listing Views" increments on every detail-page fetch with no dedup/session tracking — treat it as a directional signal, not an audited unique-visitor metric.
- Real M-Pesa payment is not yet live — the business Till number, consumer key/secret, and passkey haven't been provided. Everything else (schema, webhook, activation logic, UI) is built and tested via the dev-mode payment simulator; flipping it on is populating five env vars, nothing more.
- The expiry sweep is a single in-process timer, not a distributed job queue — correct and reliable for a single Node process (the documented deployment target), but would need a real job scheduler if the app ever runs as multiple instances (to avoid N processes all sweeping redundantly — harmless here since the sweep is idempotent, just wasteful).
- Plan management (`/admin/plans`) only supports creating new plans and retiring/reactivating existing ones (`active` toggle) — there's no edit-in-place for a plan's price/duration once created, since `FeaturedSubscription.planId` references it with `onDelete: Restrict` and any purchased plan needs its historical terms to stay exactly as they were at purchase time.
- Pagination is standard SQL offset/limit, not cursor-based. This is fast at any scale this app is realistically headed for in the near term (proper indexes mean even a deep page is a fast indexed scan, not a full table scan), but offset pagination does get slower on extremely deep pages at very large scale (hundreds of thousands of rows) — a keyset/cursor approach would be the Phase 6+ upgrade if the marketplace ever reaches that size.
- Location and body type are free-text filters (`contains`, case-insensitive), matching the free-text `location`/`bodyType` columns from Phase 1 — not a fixed dropdown of known values. A buyer typing "Nairob" won't match "Nairobi"; only trigram-indexed substring matching, not fuzzy/typo-tolerant matching, is implemented.
- The Make→Model filter's model list is sent to the browser as one payload (`getMakeModelIndex()`) rather than fetched per-make — correct and fast for a car marketplace's realistically-bounded make/model cardinality, but would need to become an on-demand fetch if the catalog ever grew to an unusually large number of distinct makes.
- No buyer-facing "my sent inquiries" history page — a buyer sees a one-time confirmation on submission but has no page listing past inquiries/their status. Reasonable scope cut for this phase; the data (`Inquiry.buyerUserId`) already supports adding one later with no schema change.
- Notifications have no delivery or UI (see "Favorites, Inquiries & Notifications" above) — rows are written and correct, but nothing surfaces them to a user yet.
- Seller inquiries dashboard has no pagination — fine at the inquiry volumes a new marketplace will see, would need it added the same way `/dashboard/listings` already has it if volume grows.
- A hand-added raw-SQL migration quirk to be aware of: any future `prisma migrate dev` will propose `DROP INDEX` for the four `car_listings_*_trgm_idx` indexes from Phase 5 (they have no schema.prisma representation, since Prisma's DSL can't express a GIN/pg_trgm operator class). Always strip those DROP INDEX lines out of the generated migration before applying — see the comment left in the Phase 6 migration for the exact pattern.
- Two Phase 6-era recommendations remain deliberately out of scope for Phase 7's admin work, since neither is an admin-moderation concern: the buyer-facing "my sent inquiries" history page (listed above) and a notifications inbox/bell UI. Both are additive — no schema change needed to add either later.
- No Content-Security-Policy header is set (Phase 9 considered and deferred it) — a strict CSP needs auditing every inline style/script Next.js itself may inject across dev and prod builds before it can be turned on without risk of silently breaking the app; the lighter headers that are safe to add blind (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are in place now. A good Phase 10 candidate once there's room to test it thoroughly.
- Image-upload validation checks file size, magic-byte signature, and count-per-listing, but does not decode/inspect actual pixel dimensions — a small file with an extreme (adversarially crafted) internal resolution could still be expensive for Next's image optimizer to process at request time. Considered out of scope for a "harden, don't redesign" phase (real mitigation would mean adding an image-processing dependency); the existing 5MB size cap bounds the practical severity for non-adversarial use.
- The admin audit log is a flat, most-recent-first list with a status/entity filter left for a future phase — fine at the volume of admin actions a new marketplace generates, but would want filtering by actor/action/date range if admin activity grows substantially.

# Backup & Recovery (Phase 9)

Documentation only — no destructive restore has been run against any real
database as part of writing this. Every procedure below should be
rehearsed against a **disposable copy** of the database before it's ever
relied on for a real incident.

This app has two categories of durable state that must be backed up
**together, consistently** — they reference each other and one without the
other is only partially useful:

1. **PostgreSQL** — every row: users, listings, images (metadata rows —
   see below), inquiries, payments, audit logs, everything.
2. **`public/uploads/`** — the actual image *files* the `CarImage.imageUrl`/
   `storageKey` columns point at (see `src/lib/storage.ts`). This is local
   disk, per the Phase 3 decision documented there and in `architecture.md`
   — it is **not** captured by a database backup at all.

A backup of only one of these is incomplete: a DB-only restore leaves
`CarImage` rows pointing at files that may not exist on the restored host;
an uploads-only backup leaves orphaned files with no listing referencing
them. Back both up on the same schedule and note their timestamps together.

## 1. Database backup strategy

**If using a managed Postgres provider** (Neon, or similar — see
`architecture.md`'s hosting notes): enable the provider's own automated
daily backups / point-in-time recovery (PITR) first. This is the primary
mechanism — it's continuous, off-host, and doesn't depend on this app's
process ever running successfully. Treat the steps below as the
self-hosted/supplemental path, or as how to pull a portable backup out of a
managed provider for off-provider archival.

**Self-hosted / supplemental logical backup** (`pg_dump`, run from a host
with network access to the database — never from inside a request handler
or a Server Action):

```bash
pg_dump --format=custom \
  --file="car_marketplace_$(date +%Y%m%d_%H%M%S).dump" \
  "$DIRECT_DATABASE_URL"
```

- `--format=custom` produces a compressed, `pg_restore`-only file — smaller
  than plain SQL and supports selective/parallel restore (see below).
- Use `DIRECT_DATABASE_URL` (the non-pooled connection), not the pooled
  `DATABASE_URL` — `pg_dump` needs a single long-lived connection, which a
  connection pooler (PgBouncer, Neon's pooler) may not support well for a
  large dump.
- **Never commit a `.dump` file to version control** — it contains real
  user data (password hashes, phone numbers, payment metadata).

**Schedule**: daily, at minimum, plus one immediately before any production
migration (`prisma migrate deploy`) or any manual admin data-repair. Retain
at least 7 daily + 4 weekly + 3 monthly snapshots if storage allows — this
app has no built-in retention policy of its own; retention is a property of
wherever backups are stored (provider snapshot policy, or a cron + object
storage lifecycle rule if self-managed).

**Where backups live**: off the database host itself, and ideally off the
app host too — object storage (S3/R2/B2 — the same family of provider
`STORAGE_PROVIDER` in `.env.example` already anticipates for images) with
versioning/lifecycle rules is the standard target. A backup that lives only
on the same disk as the database it backs up doesn't protect against host
loss.

## 2. Database restore procedure

Against a **custom-format** dump (from `pg_dump --format=custom` above):

```bash
# 1. Create a fresh, empty target database — never restore over a live one
#    without a very deliberate reason; prefer restoring alongside and
#    cutting over, so the current (possibly-still-needed) data isn't
#    destroyed by a bad restore.
createdb car_marketplace_restore

# 2. Restore
pg_restore --no-owner --no-privileges \
  --dbname="postgresql://user:password@host:5432/car_marketplace_restore" \
  car_marketplace_20260101_030000.dump

# 3. Point the app at the restored database (update DATABASE_URL /
#    DIRECT_DATABASE_URL in the deployment's environment config — never in
#    a committed file) and verify before cutting real traffic over.
```

After restoring, **before** pointing production traffic at it:

- Run `npx prisma migrate status` against the restored database — a
  restore taken before a migration was applied needs that migration
  (`npx prisma migrate deploy`) replayed before the current app code will
  work against it correctly.
- Spot-check a handful of tables (`users`, `car_listings`,
  `featured_subscriptions`, `payment_transactions`) for row counts and a
  few known records, not just "the restore command exited 0."
- Cross-check that the images referenced by the restored `car_images` rows
  actually exist in whichever `public/uploads/` backup corresponds to the
  same point in time (see below) — a mismatch here means restoring the
  image backup from a different, closer-in-time snapshot, not silently
  shipping broken image links.

## 3. Image storage recovery (`public/uploads/`)

Since this is local disk (not yet migrated to S3-compatible object storage
— see `storage.ts`'s own header comment and the "Known Limitations"
section of the main README), it needs its own backup path, independent of
`pg_dump`:

- **Snapshot the directory** (`public/uploads/listings/`) on the same
  schedule as the database dump above — a filesystem-level backup tool
  (host snapshot, `rsync` to an off-host target, or a scheduled tar +
  upload to object storage) all work; pick whatever the hosting
  environment (Namecheap Stellar Plus, per `architecture.md`) actually
  supports.
- **Restore** is the inverse: extract/copy the snapshot back to
  `public/uploads/listings/` on the target host, preserving the
  `<listingId>/<randomKey>.<ext>` directory structure `saveListingImage()`
  writes (see `storage.ts`) — the DB's `CarImage.imageUrl` values are
  literal paths under `/uploads/listings/`, so the restored files must land
  at the exact same relative paths or every restored listing shows broken
  images despite the DB restore having succeeded.
- **Once real object storage is wired up** (the `STORAGE_PROVIDER` env vars
  already reserved in `.env.example`), this entire section simplifies to
  "rely on the provider's own durability/versioning" — R2/B2/S3 are already
  built for this, and a separate file-level backup step stops being
  necessary. Until then, treat `public/uploads/` as equally critical as the
  database itself.

## 4. Environment recovery

`.env` is git-ignored by design (see its own header comment) — it is
**never** in version control, so it cannot be recovered from `git`. Recovery
depends entirely on wherever the real secrets are actually kept:

- **Production**: secrets should live in the hosting platform's own secret
  manager / environment configuration panel (not a file on disk) — that
  system is the actual backup for these values. If it doesn't have its own
  export/backup feature, maintain a **separate, access-controlled** secure
  note or secrets vault (not a plain file, not committed anywhere) listing
  every variable `.env.example` declares, with real production values.
- **Rebuilding a lost `.env` from scratch**, in order of urgency:
  1. `DATABASE_URL` / `DIRECT_DATABASE_URL` — from the database provider's
     dashboard (these can be regenerated/reset there if truly lost, though
     that invalidates the old ones for anything still using them).
  2. `AUTH_SECRET` — **cannot be safely "recovered"** if lost; regenerate
     with `npx auth secret`. Every existing session JWT signed with the old
     secret becomes invalid the moment this changes — all users are signed
     out. This is expected and safe (not a data-loss event), just a
     one-time inconvenience worth knowing about before it happens
     unexpectedly.
  3. `MPESA_*` — from the Safaricom Daraja developer portal for that
     business account; `MPESA_CALLBACK_SECRET` is self-generated
     (`openssl rand -hex 24`) and can simply be regenerated (this changes
     the webhook URL's `?token=` value — the app doesn't need the *old*
     value for anything, only the *current* one to match what's live).
  4. `CRON_SECRET` — same as above, self-generated, safe to regenerate.
  5. `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` — from the email
     provider's dashboard, once one is chosen (see README's "Known
     Limitations" — no real provider is wired up yet).
  6. `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_DEFAULT_CURRENCY` — not secrets,
     just the deployment's own public URL and default currency; reconstruct
     from what the deployment actually is.

## 5. Rollback strategy

Two independent things can need rolling back — a bad **application deploy**
and a bad **database migration** — and they roll back differently.

**Application code**: every deploy should be from a tagged/identifiable
commit (this project has no CI/CD pipeline configured yet — see Phase 10
recommendations). Rolling back is redeploying the previous known-good
commit/tag. There are no feature flags or gradual-rollout mechanisms in
this app (deliberately — see the repeated "do not overbuild" instruction
across every phase), so a code rollback is a full redeploy, not a flag
flip.

**Database migrations**: Prisma Migrate does not generate automatic "down"
migrations. This project's migration history (`prisma/migrations/`) is
append-only and forward-only by convention (see every phase's migration
notes for the pattern: additive columns/tables, backfill-then-constrain for
new `NOT NULL` columns, never a destructive `DROP COLUMN`/`DROP TABLE`
against real data). Because of that convention:

- Rolling back application code to a previous version is almost always
  **safe to do without a matching DB rollback** — every migration so far
  only *adds* columns/tables, so older app code simply ignores columns it
  doesn't know about; it never breaks because a column it expects is
  missing (the one exception would be a future migration that removes or
  renames something an older app version still reads — cross that bridge
  by never doing that against production without a coordinated two-step
  migration, i.e. stop writing to a column in the new code first, deploy,
  *then* drop it in a later migration once nothing references it).
- If a migration genuinely must be undone (wrong column type, etc.), write
  a new **forward** migration that corrects it — via
  `prisma migrate dev --create-only` and a hand-edited `migration.sql`,
  the same pattern already used repeatedly in this project (see the
  trigram-index and title/message-backfill migrations) — rather than
  attempting to delete or rewrite an already-applied migration file, which
  desyncs `_prisma_migrations`' history from what actually ran.
- For a truly catastrophic bad migration already applied to production,
  the realistic recovery path is the database restore procedure in
  section 2 above, from the backup taken immediately before that
  migration ran (see section 1's "plus one immediately before any
  production migration" rule) — not a manual hand-written undo against
  live data.

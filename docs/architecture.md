# Architecture — Phase 1

## Layering

```
Route (page/action) → Service → Prisma → PostgreSQL
                         ↑
                  Authorization + Validation
```

Routes and server actions are thin. All business rules, ownership checks, and status-transition rules live in `src/server/services/` and `src/server/authorization/`. This is the mechanism (not just the intention) behind "future AI-assisted development shouldn't break unrelated features" — a change to how SOLD works touches `listing-service.ts` and `listing-status.ts`, and nothing else needs to be understood or edited.

## Roles

`UserRole` enum: `BUYER | SELLER | ADMIN`. Stored on the `User` row, attached to the session via Auth.js's `jwt`/`session` callbacks (`src/lib/auth.ts`). Every authorization check reads `session.user.role` — never a value from the request body. Registration (`registerUser` in `auth-service.ts`) hardcodes `role: "BUYER"` with no override parameter, so there is no code path from public signup to SELLER or ADMIN.

## Ownership Model

`CarListing.sellerId` is a required foreign key to `User.id`. Every mutation that touches a specific listing goes through `requireListingOwnership(listingId)` (`src/server/authorization/ownership.ts`), which:

1. Requires an authenticated session.
2. Looks up the listing fresh from the database by its ID.
3. Confirms `listing.sellerId === session.user.id` (or the actor is an ADMIN).

The client never supplies `sellerId` for authorization purposes — it's derived entirely server-side.

## Listing Lifecycle

Enum: `DRAFT → PENDING → ACTIVE → SOLD`, with `ACTIVE ↔ ARCHIVED` and `SOLD → ACTIVE` (restore) also permitted. The full transition table lives in `src/server/services/listing-status.ts` (`assertValidTransition`) — this is the only function in the codebase allowed to authorize a status change, and every service function that changes status calls it.

## SOLD Workflow

1. Seller (or admin) calls `markListingAsSold(listingId)`.
2. `requireListingOwnership` confirms they own it.
3. `assertValidTransition` confirms `ACTIVE → SOLD` is legal for their role.
4. Inside a single Prisma transaction: `CarListing.status` → `SOLD`, `soldAt` → now, and a row is appended to `ListingStatusHistory` recording `fromStatus`, `toStatus`, `changedById`, and a note.
5. The UI's `StatusBadge` component reads `listing.status` directly — there is no separate boolean or free-text field to keep in sync, so the badge can't drift from reality.
6. Restoring to ACTIVE (`restoreListingToActive`) follows the identical path in reverse, clearing `soldAt` on the listing row but **preserving** the SOLD event permanently in `ListingStatusHistory`.

This history table is also what will power the "cars sold by seller / average time to sale" analytics mentioned in the spec, without any schema change later — it's just a query.

## Data Safety

- No destructive operation (drop, truncate, delete-many) exists anywhere in Phase 1 code.
- Foreign keys from `CarListing` to `User` use `onDelete: Restrict` — a user with active listings cannot be hard-deleted by a stray cascade; account closure should use a `status` change (`DEACTIVATED`), not a row delete. (Account deletion UI is not part of Phase 1.)
- All schema changes must go through `prisma migrate dev` in development, review, then `prisma migrate deploy` in production. No manual SQL against production, ever.

## Extension Points Left for Later Phases

- `CarListing` has a commented-out `featuredSubscriptions` relation, ready to uncomment once `FeaturedSubscription` is modeled in Phase 4 — no restructuring of the existing table required.
- `src/app/api/webhooks/payments/route.ts` exists as a documented 501 stub so the route's location and signature-verification requirements are decided now, even though it does nothing yet.
- `MarketplaceSetting` (key/value table) exists from Phase 1 so future admin-tunable config (e.g. "hide SOLD listings from search") doesn't require a schema change, just a new key.

## Hosting Notes (Namecheap Stellar Plus)

As flagged in the pre-Phase-1 review: verify Postgres availability on your Stellar Plus plan before deploying. If unavailable or impractical, use a managed Postgres provider (e.g. Neon, which offers built-in connection pooling — relevant because `DIRECT_DATABASE_URL` is kept separate from the pooled `DATABASE_URL` in this schema specifically to support that setup) while the Next.js app itself runs on Stellar Plus's Node.js app support.

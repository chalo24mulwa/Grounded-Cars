# Performance audit and optimisation (October 2026)

## How this was measured

The live site couldn't be reached from the audit environment, so the
measurements come from a production replica: the same code built with
`next build` and run with `next start`, a local PostgreSQL with every migration
in `prisma/migrations/` applied, and 13 active listings (64 photos) that copy
the live homepage and use real seller photos from `public/uploads/`. Lighthouse
12 ran in mobile mode with its default simulated slow-4G network and 4× CPU
slowdown. Each page got one warm-up run, then the median of three runs is
reported (five runs for the listing page).

Real-world numbers on carmarketplace.co.ke will differ. They also include
Hostinger's server response time and the distance from Kenya to the server.
To compare like for like, run PageSpeed Insights on the live URLs before and
after deploying.

## The main bottleneck: photos

| Page (mobile) | Score | LCP | Page weight | Photo bytes |
|---|---|---|---|---|
| `/` before | 94 | 3.0 s | 2,397 KB | 2,224 KB |
| `/` after | 96–98 | 2.2–2.7 s | 397 KB | 222 KB |
| `/cars` before | 73 | 11.2 s | 3,204 KB | 3,017 KB |
| `/cars` after | 96–98 | 2.4–2.8 s | 406 KB | 219 KB |
| `/cars/[slug]` before | 75 | 9.3 s | 2,549 KB | 2,372 KB |
| `/cars/[slug]` after | 96 | 2.3–2.8 s | 455 KB | 277 KB |

CLS was 0 before and after. TBT stayed under 200 ms. JavaScript was not the
problem: the shared first-load bundle is 102 KB and no public page goes above
116 KB.

### Why photos were so heavy

1. **Every uploaded photo went out at full size.** Uploads are stored at up
   to 1920 px, usually 130–480 KB each. Next's image optimiser can't read
   `/uploads` on Hostinger, so every `<Image>` showing an upload had
   `unoptimized` set. A 300-px card thumbnail therefore downloaded the
   full 1920-px JPEG.
2. **Each card downloaded its whole carousel.** Every slide was mounted
   in the sliding track, so a grid of 24 cards loaded up to 6 photos per card
   before anyone swiped. The listing page did the same with all of its gallery
   photos.
3. **Hero artwork was stored as 2 MB PNGs.** These are the homepage, CSR and
   pre-purchase-inspection heroes. Optimised copies were cached for only 60
   seconds, so the server kept re-optimising the same image.

## What changed

* **Resized photo variants.** `src/app/uploads/[...path]/route.ts` now also
  serves `/uploads/_v/<width>/<path>`. The first request resizes the original
  with sharp to WebP (or JPEG for browsers that don't accept WebP) and saves
  the result under `<UPLOAD_ROOT>/.variants/`. Later requests are served from
  that file with a one-year immutable cache. At most two resizes run at
  once. Widths are allowlisted. Path-traversal checks are unchanged. A
  variant stops being served once its original is deleted, and deleting a
  photo or listing also removes its variants (`src/lib/storage.ts`).
  Example: a 390 KB photo becomes 56 KB at 640 px and 26 KB at 384 px.
* **`<UploadedImage>`** (`src/components/ui/UploadedImage.tsx`) is next/image
  with a loader that points at those variants, so browsers pick a
  right-sized photo from a srcset. It replaced every `unoptimized` image that
  shows an upload on public pages and dashboards. The new-listing form's
  local `blob:` previews are untouched.
* **Lazy carousels.** Cards load only their cover photo until the visitor
  interacts with them. The listing gallery mounts only the visible photo and
  its two neighbours.
* **LCP priority.** On `/cars`, `/best-deals` and location pages, the first two
  cards' cover photos are preloaded.
* **Hero images** were re-encoded from PNG to JPEG at the same dimensions:
  2.0 MB to 0.25–0.3 MB each.
* **`next.config.mjs`:** fewer optimiser widths (no 2048/3840), WebP output,
  a 30-day cache for optimised images, and a 1-day browser cache (plus 7-day
  stale-while-revalidate) for `/brand/*` and `/images/*`.
* **Start-up warm-up** (`src/instrumentation.ts`): when the server boots,
  the header counts, filter options and the first page of listings start
  loading in the background. A restarted process, or a Neon database waking
  from suspend, is then already warming up before the first visitor arrives.

Nothing about authentication, roles, payments, uploads, watermarking, SEO
metadata or the database schema changed. No migration is required.

## Database

Already in good shape. The public queries are indexed: `car_listings` has
`(status, …)` composites plus trigram indexes for search, and
`featured_subscriptions` has `(status, expiresAt)`. Listing pages paginate
in the database (`skip`/`take`) and cap card images at 6 per listing.
Public reads go through the in-memory stale-while-revalidate cache
(`src/lib/swr-cache.ts`), so a typical page view makes no database round trip
at all. No N+1 patterns were found. No new indexes were added, because none
of the measured page loads were waiting on the database.

## Hosting recommendations (outside the codebase)

These are probably the biggest remaining factors for visitors in Kenya.

1. **Keep the app and the database awake.** Hostinger can stop an idle
   Node.js app, and Neon suspends an idle database after about 5 minutes.
   The first visitor after a quiet spell then waits for both to start. In
   hPanel → Advanced → Cron Jobs, add one that runs every 5 minutes:
   `curl -s -o /dev/null https://carmarketplace.co.ke/`
   On a paid Neon plan, you can also raise or turn off autosuspend.
2. **Put the database next to the server.** Every uncached query is a round
   trip from Hostinger to Neon. If they are on different continents, each
   query adds 100–300 ms. Check the Hostinger server location (hPanel →
   Hosting → Details) and use a Neon project in the same region, for example
   Frankfurt (`aws-eu-central-1`) for a European data centre.
3. **Use Neon's pooled connection string** (host contains `-pooler`) for
   `DATABASE_URL`, and the direct one for `DIRECT_DATABASE_URL`, as
   `.env.example` describes. `src/lib/prisma.ts` already keeps the pool small
   (5) with longer connect timeouts.
4. **Add a CDN in front of the site** (Hostinger CDN or Cloudflare's free
   plan). With the new immutable cache headers, product photos, `_next/static`
   and optimised images are served from an edge near Kenya (Cloudflare has
   a Nairobi location) instead of crossing to the origin. Leave HTML
   uncached at the CDN: pages are personalised by the login session.
5. **Disk:** resized variants are small (in testing, 1.9 MB of variants for 15 MB
   of originals) and live in `UPLOAD_STORAGE_DIR/.variants`. You can delete that folder
   at any time; it rebuilds itself on demand.

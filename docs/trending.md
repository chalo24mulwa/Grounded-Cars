# Trending (short car videos)

A TikTok-style video feed at `/trending`. Videos are uploaded straight from the
phone to **Mux**, resized there, and **deleted completely 7 days after posting**.

The feature is **switched off** until `TRENDING_ENABLED=true` is set. While it is
off, every `/trending` page returns 404, the utility-bar link and the admin menu
item are hidden, the Mux webhook ignores calls, and the cleanup job does nothing.
That is why this code can be deployed before its database tables exist.

## What it does

- **Profiles** are created automatically. Existing users get one from the
  migration; new users get one the first time they open Trending. Signup itself
  is untouched. Users can change their display name, @username, bio and picture.
  The old picture file is deleted when it's replaced or removed.
- **Uploads** are limited to 60 minutes. The browser checks the length first, and
  the server checks again using the length Mux measures. A longer video is
  rejected and deleted from Mux. Uploads go in 5 MB chunks that resume after a
  dropped connection, and the file never passes through our server.
- **Playback** is HLS, capped at 720p, and starts at the lowest quality so it
  begins fast on slow data. Only the video on screen plays, and only the next
  one is preloaded. Thumbnails are small WebP images. The video player code is
  loaded on Trending pages only.
- **Likes, comments, replies and comment likes.** Replies are one level deep.
  Comment authors can edit and delete their own comments, and video owners can
  delete any comment on their video.
- **Sharing** works through WhatsApp, Facebook, X, Telegram, email and copy link.
  The phone's own share menu reaches Instagram, TikTok and any other installed
  app. Shared links show a preview through Open Graph tags.
- **Private messages** have an inbox with unread counts and refresh
  automatically. Users can block each other, which hides videos and messages
  both ways.
- **Reports** cover videos, comments and accounts. Admins handle them at
  **Admin → Trending**, where they can remove a video, delete a comment, suspend
  someone's posting, resolve or dismiss a report, see storage use, and run the
  cleanup immediately.

## Automatic deletion (7 days)

Every video has `expiresAt = posted time + TRENDING_VIDEO_TTL_HOURS` (default
168, which is 7 days).

- At `expiresAt` the video disappears from the feed, profiles and its link
  immediately. Expired links show a friendly "This video has expired" page.
- The hourly cleanup then deletes the Mux asset, which removes the video, every
  resized copy and the thumbnails. It also deletes the cover image file and the
  database row. Likes, comments, replies and comment likes are deleted with the
  row.
- **Messages are kept.** A message that pointed at the video shows "This video
  is no longer available".
- Uploads that failed or were abandoned are removed after 24 hours.
- The cleanup works in batches, is safe to run any number of times, and retries
  anything that failed on the next run.

The cleanup runs inside the app every hour, as part of the same sweep that
expires subscriptions. It also runs whenever the cron URL below is called.

**Testing without waiting 7 days:** set `TRENDING_VIDEO_TTL_HOURS=0.02` (about
72 seconds) on a test server, post a video, wait, then call the cron URL.

## Turning it on (one time)

### 1. Create the database tables

This is safe because it only **adds** new tables. Nothing existing is changed or
removed.

Run these commands on your computer, in PowerShell, in the project folder:

```powershell
git pull
npm install
$env:DATABASE_URL = "<DATABASE_URL from Hostinger → Website → Node.js → Environment variables>"
$env:DIRECT_DATABASE_URL = "<DIRECT_DATABASE_URL from the same place>"
npx prisma migrate deploy
```

You should see `Applying migration 20261013060000_add_trending` and then
"All migrations have been successfully applied." Close the PowerShell window
afterwards so the database address isn't left in it.

### 2. Mux

1. Create a Mux account at <https://mux.com>. Mux is a paid service, so check
   its current pricing first.
2. Go to **Settings → Access Tokens → Generate new token**. Choose the
   Production environment and give it **Mux Video: Read and Write**. Copy the
   Token ID and Secret.
3. Go to **Settings → Webhooks → Create new webhook**. Set the URL to
   `https://carmarketplace.co.ke/api/webhooks/mux`, then copy its
   **Signing Secret**.

### 3. Hostinger environment variables

Add these, then redeploy or restart the app:

| Name | Value |
| --- | --- |
| `MUX_TOKEN_ID` | from step 2 |
| `MUX_TOKEN_SECRET` | from step 2 |
| `MUX_WEBHOOK_SECRET` | the webhook signing secret |
| `CRON_SECRET` | any long random text (skip if it's already set) |
| `TRENDING_ENABLED` | `true` (set this last, after steps 1–2) |

`TRENDING_VIDEO_TTL_HOURS` is optional and defaults to 168. Leave it unset in
production.

### 4. Hostinger cron job (backup for the hourly cleanup)

In hPanel go to **Advanced → Cron Jobs**, choose **Custom**, and set it to run
**every hour**:

```
curl -s -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://carmarketplace.co.ke/api/cron/expiry
```

The app already runs the sweep hourly by itself. This cron job makes sure it
still runs after a restart.

## Turning it off again

Set `TRENDING_ENABLED` to anything other than `true` and restart. All data stays
in place. Note that cleanup is paused while the feature is off.

## Notes

- **720p:** Mux's smallest storage tier is 1080p, so viewers are capped at 720p
  through the playback URL (`?max_resolution=720p`), and the player also never
  loads more than the screen needs. Storage cost follows Mux's basic quality
  tier.
- **Rate limits:** 10 uploads per hour, and limits on comments, messages and
  reports, to stop spam.
- **Code:** the code lives in `src/lib/trending/`, `src/server/services/trending/`,
  `src/server/actions/trending-actions.ts`, `src/app/trending/`,
  `src/components/trending/`, `src/app/api/webhooks/mux/` and
  `src/app/(admin)/admin/trending/`.

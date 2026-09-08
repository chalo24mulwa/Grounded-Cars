/*
  Warnings:

  - Added the required column `message` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `notifications` table without a default value. This is not possible if the table is not empty.

  Hand-edited from the Prisma-generated draft:

  1. The four `DropIndex` statements Prisma proposed for the Phase 5
     trigram (pg_trgm) indexes are removed. Those indexes have no
     schema.prisma representation (Prisma's DSL can't express a GIN/trgm
     operator class), so every `migrate dev` since Phase 5 proposes dropping
     them — this is a known, documented false-positive drift, not a real
     schema change. See README.md.
  2. `title`/`message` are added as nullable, backfilled from each existing
     row's `type` (there are 4 rows in dev today), then made NOT NULL — the
     three-step "add nullable → backfill → constrain" pattern is what makes
     an additive migration safe against a NOT NULL column on a non-empty
     table without inventing a meaningless shared default value.
*/
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "message" TEXT,
ADD COLUMN     "relatedEntityId" TEXT,
ADD COLUMN     "relatedEntityType" TEXT,
ADD COLUMN     "title" TEXT;

-- Backfill existing rows (dev/staging data only) with generic, safe copy
-- based on their existing `type` — new rows going forward always supply
-- real title/message via notification-service.ts's NOTIFICATION_COPY.
UPDATE "notifications" SET
  "title" = CASE "type"
    WHEN 'INQUIRY_RECEIVED' THEN 'New inquiry received'
    WHEN 'INQUIRY_REPLIED' THEN 'Seller replied to your inquiry'
    WHEN 'FAVORITE_LISTING_SOLD' THEN 'A favorited listing was sold'
    WHEN 'SUBSCRIPTION_EXPIRED' THEN 'Featured subscription expired'
    ELSE 'Notification'
  END,
  "message" = CASE "type"
    WHEN 'INQUIRY_RECEIVED' THEN 'You have a new inquiry about one of your listings.'
    WHEN 'INQUIRY_REPLIED' THEN 'The seller replied to your inquiry — check it for details.'
    WHEN 'FAVORITE_LISTING_SOLD' THEN 'A car you favorited has been marked as sold.'
    WHEN 'SUBSCRIPTION_EXPIRED' THEN 'Your featured listing subscription has expired.'
    ELSE 'You have a new notification.'
  END
WHERE "title" IS NULL;

ALTER TABLE "notifications" ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "message" SET NOT NULL;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_reminders" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_reminders_subscriptionId_reminderType_key" ON "subscription_reminders"("subscriptionId", "reminderType");

-- CreateIndex
CREATE INDEX "notifications_relatedEntityType_relatedEntityId_idx" ON "notifications"("relatedEntityType", "relatedEntityId");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_reminders" ADD CONSTRAINT "subscription_reminders_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "featured_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

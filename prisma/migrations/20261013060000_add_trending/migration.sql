/*
  Trending (TikTok-style car videos) — purely additive: new enums, new tables,
  new indexes and foreign keys only. No existing table, column or row is
  changed or removed. Written by hand in Prisma's own naming conventions
  (the schema engine binary wasn't available in the authoring environment);
  matches prisma/schema.prisma's Trending models exactly.

  The final statement backfills one Trending profile for every existing user,
  so nobody has to "sign up" for Trending separately.
*/

-- CreateEnum
CREATE TYPE "TrendingVideoStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TrendingReportTarget" AS ENUM ('VIDEO', 'COMMENT', 'PROFILE');

-- CreateEnum
CREATE TYPE "TrendingReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "trending_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "avatarKey" TEXT,
    "postingSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trending_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_videos" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "TrendingVideoStatus" NOT NULL DEFAULT 'UPLOADING',
    "muxUploadId" TEXT,
    "muxAssetId" TEXT,
    "muxPlaybackId" TEXT,
    "title" TEXT,
    "caption" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "price" INTEGER,
    "location" TEXT,
    "listingId" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "aspectRatio" TEXT,
    "coverUrl" TEXT,
    "coverKey" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "removedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trending_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_video_likes" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_video_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_comments" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_conversations" (
    "id" TEXT NOT NULL,
    "profileAId" TEXT NOT NULL,
    "profileBId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "videoRefId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "TrendingReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "TrendingReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trending_profiles_userId_key" ON "trending_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trending_profiles_username_key" ON "trending_profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "trending_videos_muxUploadId_key" ON "trending_videos"("muxUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "trending_videos_muxAssetId_key" ON "trending_videos"("muxAssetId");

-- CreateIndex
CREATE INDEX "trending_videos_status_expiresAt_createdAt_idx" ON "trending_videos"("status", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "trending_videos_profileId_createdAt_idx" ON "trending_videos"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "trending_videos_expiresAt_idx" ON "trending_videos"("expiresAt");

-- CreateIndex
CREATE INDEX "trending_video_likes_profileId_idx" ON "trending_video_likes"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "trending_video_likes_videoId_profileId_key" ON "trending_video_likes"("videoId", "profileId");

-- CreateIndex
CREATE INDEX "trending_comments_videoId_parentId_createdAt_idx" ON "trending_comments"("videoId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "trending_comments_parentId_createdAt_idx" ON "trending_comments"("parentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trending_comment_likes_commentId_profileId_key" ON "trending_comment_likes"("commentId", "profileId");

-- CreateIndex
CREATE INDEX "trending_conversations_profileAId_lastMessageAt_idx" ON "trending_conversations"("profileAId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "trending_conversations_profileBId_lastMessageAt_idx" ON "trending_conversations"("profileBId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "trending_conversations_profileAId_profileBId_key" ON "trending_conversations"("profileAId", "profileBId");

-- CreateIndex
CREATE INDEX "trending_messages_conversationId_createdAt_idx" ON "trending_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "trending_blocks_blockedId_idx" ON "trending_blocks"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "trending_blocks_blockerId_blockedId_key" ON "trending_blocks"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "trending_reports_status_createdAt_idx" ON "trending_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "trending_reports_targetType_targetId_idx" ON "trending_reports"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "trending_profiles" ADD CONSTRAINT "trending_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_videos" ADD CONSTRAINT "trending_videos_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_videos" ADD CONSTRAINT "trending_videos_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "car_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_video_likes" ADD CONSTRAINT "trending_video_likes_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "trending_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_video_likes" ADD CONSTRAINT "trending_video_likes_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_comments" ADD CONSTRAINT "trending_comments_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "trending_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_comments" ADD CONSTRAINT "trending_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_comments" ADD CONSTRAINT "trending_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "trending_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_comment_likes" ADD CONSTRAINT "trending_comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "trending_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_comment_likes" ADD CONSTRAINT "trending_comment_likes_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_conversations" ADD CONSTRAINT "trending_conversations_profileAId_fkey" FOREIGN KEY ("profileAId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_conversations" ADD CONSTRAINT "trending_conversations_profileBId_fkey" FOREIGN KEY ("profileBId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_messages" ADD CONSTRAINT "trending_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "trending_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_messages" ADD CONSTRAINT "trending_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_blocks" ADD CONSTRAINT "trending_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_blocks" ADD CONSTRAINT "trending_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_reports" ADD CONSTRAINT "trending_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "trending_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one Trending profile per existing user. Username = letters/digits
-- of their name (max 20) + "_" + the last 6 characters of their user id
-- (random in a cuid), e.g. "johnmwangi_k3x9qa". Users can change it later.
-- ON CONFLICT DO NOTHING: in the very unlikely event of a clash that user's
-- profile is simply created on their first visit instead.
INSERT INTO "trending_profiles" ("id", "userId", "username", "displayName", "createdAt", "updatedAt")
SELECT
    'tp' || substr(md5(u."id" || clock_timestamp()::text), 1, 23),
    u."id",
    lower(COALESCE(NULLIF(left(regexp_replace(u."name", '[^a-zA-Z0-9]', '', 'g'), 20), ''), 'user')) || '_' || lower(right(u."id", 6)),
    COALESCE(NULLIF(trim(u."name"), ''), 'Car Marketplace user'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" u
ON CONFLICT DO NOTHING;

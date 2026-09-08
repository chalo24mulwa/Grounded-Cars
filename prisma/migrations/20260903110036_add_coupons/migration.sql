/*
  Hand-edited from the Prisma-generated draft (same pattern as every prior
  migration in this project — see prisma/migrations/20260831093932_add_import_status
  and README.md): the four trigram-index DropIndex statements are removed —
  known, documented false-positive drift (no schema.prisma representation for
  a GIN/pg_trgm operator class), unrelated to this migration's actual
  Coupon/CouponRedemption addition.
*/
-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('FEATURED_LISTING', 'SERVICE_ORDER');

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "usageLimitPerUser" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "scope" "CouponScope" NOT NULL,
    "userId" TEXT,
    "customerPhone" TEXT,
    "discountPercent" INTEGER NOT NULL,
    "originalAmount" DECIMAL(10,2) NOT NULL,
    "discountedAmount" DECIMAL(10,2) NOT NULL,
    "subscriptionId" TEXT,
    "serviceOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_archived_idx" ON "coupons"("archived");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_userId_idx" ON "coupon_redemptions"("couponId", "userId");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_customerPhone_idx" ON "coupon_redemptions"("couponId", "customerPhone");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

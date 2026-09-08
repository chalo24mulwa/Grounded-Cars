/*
  Warnings:

  - The `status` column on the `inquiries` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `sellerId` to the `inquiries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `inquiries` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'CLOSED');

-- The four DROP INDEX statements Prisma auto-generated here for the
-- car_listings_*_trgm_idx indexes were removed by hand. Those indexes were
-- themselves hand-added raw SQL in the Phase 5 migration (Prisma's schema
-- DSL can't express a GIN/pg_trgm operator class), so they have no
-- representation in schema.prisma — every future `prisma migrate dev` will
-- keep proposing to drop them for the same reason. Never accept that; the
-- fix each time is exactly this: strip the DROP INDEX lines for them out of
-- the generated migration before applying, same as here.

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "sellerId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "InquiryStatus" NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "favorites_listingId_idx" ON "favorites"("listingId");

-- CreateIndex
CREATE INDEX "inquiries_sellerId_status_idx" ON "inquiries"("sellerId", "status");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

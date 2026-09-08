/*
  Warnings:

  - Added the required column `importStatus` to the `car_listings` table without a default value. This is not possible if the table is not empty.

  Hand-edited from the Prisma-generated draft (same pattern as every prior
  "add a required column to a non-empty table" migration in this project —
  see e.g. the Phase 8 Notification title/message migration):

  1. The four trigram-index DropIndex statements are removed — known,
     documented false-positive drift (no schema.prisma representation for a
     GIN/pg_trgm operator class). See README.md.
  2. `importStatus` is added nullable, backfilled from each existing row's
     `condition` (a reasonable heuristic: LOCALLY_USED condition implies
     LOCALLY_USED import status; BRAND_NEW/FOREIGN_USED/unset condition
     defaults to FRESH_IMPORT, the closer of the two to "not locally used"),
     then constrained NOT NULL. Every listing created after this migration
     always supplies a real value — see createListingSchema.
*/
-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('LOCALLY_USED', 'FRESH_IMPORT');

-- AlterTable
ALTER TABLE "car_listings" ADD COLUMN     "importStatus" "ImportStatus";

UPDATE "car_listings" SET "importStatus" = CASE
  WHEN "condition" = 'LOCALLY_USED' THEN 'LOCALLY_USED'::"ImportStatus"
  ELSE 'FRESH_IMPORT'::"ImportStatus"
END
WHERE "importStatus" IS NULL;

ALTER TABLE "car_listings" ALTER COLUMN "importStatus" SET NOT NULL;

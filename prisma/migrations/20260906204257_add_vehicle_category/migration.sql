-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('CARS', 'SUV_TRUCKS', 'LORRIES_BUSES', 'EV_CARS', 'EV_BIKES');

/* Hand-edited: Prisma's diff always proposes dropping the four pg_trgm GIN
   indexes on car_listings (title/make/model/location) because they have no
   schema.prisma representation. These are real, load-bearing indexes for
   fuzzy search — never actually drop them. Same precedent as
   prisma/migrations/20260831093932_add_import_status. */

-- AlterTable
ALTER TABLE "car_listings" ADD COLUMN     "category" "VehicleCategory" NOT NULL DEFAULT 'CARS';

-- CreateIndex
CREATE INDEX "car_listings_status_category_idx" ON "car_listings"("status", "category");

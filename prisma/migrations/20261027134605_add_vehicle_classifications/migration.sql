-- CreateEnum
CREATE TYPE "VehicleClassification" AS ENUM ('GROUNDED', 'SALVAGE', 'AUCTION', 'OLD_SCHOOL');

-- AlterTable
ALTER TABLE "car_listings" ADD COLUMN     "classifications" "VehicleClassification"[] DEFAULT ARRAY[]::"VehicleClassification"[],
ALTER COLUMN "importStatus" DROP NOT NULL;

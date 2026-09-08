/*
  Hand-edited from the Prisma-generated draft (same pattern as every prior
  migration in this project that touches an unrelated table while the
  trigram indexes exist — see prisma/migrations/20260831093932_add_import_status
  and README.md): the four trigram-index DropIndex statements are removed —
  known, documented false-positive drift (no schema.prisma representation for
  a GIN/pg_trgm operator class), unrelated to this migration's actual CSR
  additions.
*/
-- CreateEnum
CREATE TYPE "CsrInitiativeStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CsrDonationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "csr_initiatives" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "amountRaised" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "CsrInitiativeStatus" NOT NULL DEFAULT 'ACTIVE',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "coverImageStorageKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csr_initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csr_initiative_images" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csr_initiative_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csr_donations" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "donorName" TEXT,
    "donorEmail" TEXT,
    "donorPhone" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "CsrDonationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MPESA',
    "providerTransactionId" TEXT,
    "metadata" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "csr_donations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "csr_initiatives_slug_key" ON "csr_initiatives"("slug");

-- CreateIndex
CREATE INDEX "csr_initiatives_published_status_idx" ON "csr_initiatives"("published", "status");

-- CreateIndex
CREATE INDEX "csr_initiative_images_initiativeId_idx" ON "csr_initiative_images"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "csr_donations_providerTransactionId_key" ON "csr_donations"("providerTransactionId");

-- CreateIndex
CREATE INDEX "csr_donations_initiativeId_idx" ON "csr_donations"("initiativeId");

-- CreateIndex
CREATE INDEX "csr_donations_status_idx" ON "csr_donations"("status");

-- AddForeignKey
ALTER TABLE "csr_initiatives" ADD CONSTRAINT "csr_initiatives_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csr_initiative_images" ADD CONSTRAINT "csr_initiative_images_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "csr_initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csr_donations" ADD CONSTRAINT "csr_donations_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "csr_initiatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

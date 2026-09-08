/*
  Hand-edited from the Prisma-generated draft (same pattern as every prior
  migration in this project — see prisma/migrations/20260831093932_add_import_status
  and README.md): the four trigram-index DropIndex statements are removed —
  known, documented false-positive drift (no schema.prisma representation for
  a GIN/pg_trgm operator class), unrelated to this migration's actual
  InsurancePurchase addition.
*/
-- CreateEnum
CREATE TYPE "InsurancePurchaseStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "insurance_purchases" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "InsurancePurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MPESA',
    "providerTransactionId" TEXT,
    "metadata" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "insurance_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_purchases_providerTransactionId_key" ON "insurance_purchases"("providerTransactionId");

-- CreateIndex
CREATE INDEX "insurance_purchases_policyId_idx" ON "insurance_purchases"("policyId");

-- CreateIndex
CREATE INDEX "insurance_purchases_status_idx" ON "insurance_purchases"("status");

-- AddForeignKey
ALTER TABLE "insurance_purchases" ADD CONSTRAINT "insurance_purchases_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "insurance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

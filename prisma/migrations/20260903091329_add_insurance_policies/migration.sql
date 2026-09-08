/*
  Hand-edited from the Prisma-generated draft (same pattern as every prior
  migration in this project — see prisma/migrations/20260831093932_add_import_status
  and README.md): the four trigram-index DropIndex statements are removed —
  known, documented false-positive drift (no schema.prisma representation for
  a GIN/pg_trgm operator class), unrelated to this migration's actual
  InsurancePolicy addition.
*/
-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startingPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "imageUrl" TEXT,
    "imageStorageKey" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_policies_published_archived_idx" ON "insurance_policies"("published", "archived");

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "car_listings_make_model_idx";

-- CreateIndex
CREATE INDEX "car_listings_status_make_model_idx" ON "car_listings"("status", "make", "model");

-- CreateIndex
CREATE INDEX "car_listings_status_price_idx" ON "car_listings"("status", "price");

-- CreateIndex
CREATE INDEX "car_listings_status_year_idx" ON "car_listings"("status", "year");

-- CreateIndex
CREATE INDEX "car_listings_status_mileage_idx" ON "car_listings"("status", "mileage");

-- Trigram indexes for keyword/substring search (Make, Model, Title,
-- Location — the fields `q` and the free-text `location` filter search via
-- ILIKE '%term%'). A plain B-tree index can't accelerate a leading-wildcard
-- LIKE; pg_trgm's GIN indexes can. This is hand-added here because Prisma's
-- schema DSL has no way to express an index operator class — it is not
-- something `prisma migrate dev` can regenerate from schema.prisma alone,
-- so if this model's indexes are ever changed again, these four statements
-- must be re-added to the new migration by hand, the same way this one was.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "car_listings_title_trgm_idx" ON "car_listings" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "car_listings_make_trgm_idx" ON "car_listings" USING GIN ("make" gin_trgm_ops);
CREATE INDEX "car_listings_model_trgm_idx" ON "car_listings" USING GIN ("model" gin_trgm_ops);
CREATE INDEX "car_listings_location_trgm_idx" ON "car_listings" USING GIN ("location" gin_trgm_ops);

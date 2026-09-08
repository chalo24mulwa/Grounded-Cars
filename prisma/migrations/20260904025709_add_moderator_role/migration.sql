-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MODERATOR';

/* Hand-edited: Prisma's diff always proposes dropping the four pg_trgm GIN
   indexes on car_listings (title/make/model/location) because they have no
   schema.prisma representation. These are real, load-bearing indexes for
   fuzzy search — never actually drop them. Same precedent as
   prisma/migrations/20260831093932_add_import_status. */

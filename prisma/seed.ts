import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Development/staging seed data only. Never run against production —
// see docs/database-schema.md for the safe-migration policy.
async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const seller = await prisma.user.upsert({
    where: { email: "seller@example.com" },
    update: {},
    create: {
      name: "Jane Seller",
      email: "seller@example.com",
      passwordHash,
      role: "SELLER",
      phone: "+254700000000",
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@example.com" },
    update: {},
    create: {
      name: "Sam Buyer",
      email: "buyer@example.com",
      passwordHash,
      role: "BUYER",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@carmarketplace.co.ke" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@carmarketplace.co.ke",
      passwordHash,
      role: "ADMIN",
    },
  });

  const listing = await prisma.carListing.upsert({
    where: { slug: "2019-toyota-axio-seed" },
    update: {},
    create: {
      sellerId: seller.id,
      slug: "2019-toyota-axio-seed",
      title: "2019 Toyota Axio — Well Maintained",
      make: "Toyota",
      model: "Axio",
      year: 2019,
      price: 1850000,
      currency: "KES",
      mileage: 62000,
      transmission: "AUTOMATIC",
      fuelType: "PETROL",
      condition: "FOREIGN_USED",
      importStatus: "FRESH_IMPORT",
      location: "Nairobi",
      status: "ACTIVE",
      images: {
        create: [
          {
            // .jpg suffix requests a raster image — placehold.co defaults to
            // SVG, which next/image refuses to optimize (a deliberate
            // security default against embedded-script SVGs), causing a 400.
            imageUrl: "https://placehold.co/800x600.jpg?text=Toyota+Axio",
            displayOrder: 0,
            isPrimary: true,
          },
        ],
      },
    },
  });

  // FeaturedPlan has no natural unique key (by design — plans are catalog
  // rows an admin will manage later, not a fixed enum), so seeding uses a
  // find-then-create instead of upsert to stay idempotent across reruns.
  const planSeeds = [
    { name: "3-Day Boost", durationDays: 3, price: 300 },
    { name: "7-Day Featured", durationDays: 7, price: 600 },
    { name: "30-Day Premium", durationDays: 30, price: 2000 },
  ];
  for (const plan of planSeeds) {
    const existing = await prisma.featuredPlan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.featuredPlan.create({ data: { ...plan, currency: "KES" } });
    }
  }

  console.log({ seller: seller.email, buyer: buyer.email, admin: admin.email, listing: listing.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

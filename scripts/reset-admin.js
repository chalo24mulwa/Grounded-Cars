// One-off maintenance script: resets (creates if missing, or fixes if
// present) the single ADMIN account at admin@carmarketplace.co.ke to the
// password below. Written as plain CommonJS JS (not .ts, and no tsx
// import) so it runs with a bare `node`, since ts-node/tsx are
// devDependencies that a production `npm ci --omit=dev`-style install
// wouldn't have available on the server.
//
// Run this ON THE SERVER (Hostinger's Node.js app terminal/SSH), from the
// project root, so it uses that environment's own already-configured
// DATABASE_URL — never paste a production connection string anywhere else:
//
//   node scripts/reset-admin.js
//
// Safe to run more than once (idempotent) — it only ever touches this one
// user row by email, never any other user, listing, or table.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const ADMIN_EMAIL = "admin@carmarketplace.co.ke";
const ADMIN_PASSWORD = "Password123!";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: "ADMIN", status: "ACTIVE" },
    create: {
      name: "Admin User",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin account ready: ${admin.email} (role: ${admin.role}, status: ${admin.status})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

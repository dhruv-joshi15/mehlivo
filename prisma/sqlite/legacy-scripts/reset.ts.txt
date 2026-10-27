import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
if (
  process.env.NODE_ENV === "production" ||
  process.env.DATABASE_URL !== "file:./dev.db" ||
  !process.argv.includes("--confirm-local-reset")
)
  throw new Error(
    "Reset only supports the default local database. Run npm run db:reset -- --confirm-local-reset to delete ALL local test records.",
  );
const db = new PrismaClient();
await db.$transaction([
  db.developmentMessage.deleteMany(),
  db.emailOutbox.deleteMany(),
  db.verification.deleteMany(),
  db.rateLimit.deleteMany(),
  db.user.deleteMany(),
]);
await db.$disconnect();
execFileSync("node", ["--import", "tsx", "prisma/seed.ts"], {
  stdio: "inherit",
});

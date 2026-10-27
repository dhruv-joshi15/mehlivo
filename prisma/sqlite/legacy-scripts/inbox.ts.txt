import "dotenv/config";
import { db } from "../src/lib/db";
import { flushOutbox } from "../src/lib/mail";
if (
  process.env.NODE_ENV === "production" ||
  !process.env.DATABASE_URL?.startsWith("file:")
)
  throw new Error("Development inbox is unavailable in production.");
await flushOutbox();
const email = process.argv[2];
if (!email) throw new Error("Usage: npm run inbox -- you@example.com");
for (const m of await db.emailOutbox.findMany({
  where: { recipient: email },
  orderBy: { createdAt: "desc" },
  take: 20,
}))
  console.log(
    `\nDevelopment preview — not delivered\n${m.createdAt.toISOString()} | ${m.subject}\n${m.body}\n`,
  );
await db.$disconnect();

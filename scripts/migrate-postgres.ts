import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
config({ path: ".env.local", quiet: true });

// Never emit Prisma errors or subprocess output: connection errors can contain URLs.
async function migrate() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const value = process.env[key] ?? "";
    if (!/^postgres(ql)?:\/\//.test(value) || /PASTE_|\[YOUR/.test(value)) {
      throw new Error(`Fill ${key} privately in .env.local before migrating.`);
    }
    const url = new URL(value);
    if ((url.searchParams.get("schema") ?? "public") !== "public") {
      throw new Error("This migration setup requires the public schema. Stop and review the target.");
    }
  }
  const runtime = new PrismaClient();
  const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  try {
    await runtime.$queryRaw`SELECT 1`;
    await direct.$queryRaw`SELECT 1`;
    console.log("Runtime and migration connectivity verified.");
    const tables = await direct.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    // This command initializes a NEW database only. Any existing table requires review.
    if (tables.length > 0) {
      throw new Error("Existing public tables detected. Stopped without applying migrations; review the database before proceeding.");
    }
  } finally {
    await Promise.all([runtime.$disconnect(), direct.$disconnect()]);
  }
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: process.env, encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("Migration did not complete. Output withheld to protect credentials. Inspect migration status privately before retrying; do not reset the database.");
  }
  console.log("Initial PostgreSQL migration applied. No seed data was added.");
}
try {
  await migrate();
} catch (error) {
  const safe = error instanceof Error && (
    error.message.startsWith("Fill ") || error.message.startsWith("Existing public") ||
    error.message.startsWith("This migration") || error.message.startsWith("Migration did not")
  );
  console.error(safe ? error.message : "Database check failed. Verify credentials, network access and TLS privately. No reset or seed was run.");
  process.exitCode = 1;
}

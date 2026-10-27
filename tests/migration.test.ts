import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
test("committed migration initializes a fresh SQLite database", async () => {
  const folder = mkdtempSync(join(tmpdir(), "mehlivo-migration-"));
  const path = join(folder, "test.db");
  writeFileSync(path, "");
  const url = "file:" + path;
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    execFileSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" },
    );
    assert.equal(await client.user.count(), 0);
    assert.equal(await client.event.count(), 0);
    assert.equal(await client.privateToken.count(), 0);
    assert.equal(await client.emailOutbox.count(), 0);
  } finally {
    await client.$disconnect();
    rmSync(folder, { recursive: true, force: true });
  }
});
test("seed, reset and inbox operator commands refuse production", () => {
  for (const script of [
    "prisma/seed.ts",
    "scripts/reset.ts",
    "scripts/inbox.ts",
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", script, "--confirm-local-reset"],
      { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0, script);
    assert.match(
      result.stderr,
      /production|local SQLite|local database|unavailable/i,
    );
  }
});

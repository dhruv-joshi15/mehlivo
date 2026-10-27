import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("archived migration initializes a fresh SQLite database", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(readFileSync("prisma/sqlite/migrations/20261027070615_init/migration.sql", "utf8"));
    for (const table of ["User", "Event", "PrivateToken", "EmailOutbox"]) {
      assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get()?.count, 0);
    }
  } finally {
    database.close();
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
      /disabled during the PostgreSQL transition/i,
    );
  }
});

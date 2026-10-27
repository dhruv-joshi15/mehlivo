import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    `DATABASE_URL="file:./dev.db"\nBETTER_AUTH_URL="http://localhost:3000"\nBETTER_AUTH_SECRET="${randomBytes(48).toString("hex")}"\n`,
  );
if (!existsSync("prisma/dev.db")) writeFileSync("prisma/dev.db", "");
execFileSync("npx", ["prisma", "generate"], { stdio: "inherit" });
execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });

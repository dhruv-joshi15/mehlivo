import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js loads .env.local automatically; Prisma CLI must load it explicitly.
// Hosting-provided variables take precedence over local files.
config({ path: ".env.local", quiet: true });
export default defineConfig({ schema: "prisma/schema.prisma" });

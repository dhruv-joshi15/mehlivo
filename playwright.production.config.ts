import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/production",
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  reporter: "list",
});

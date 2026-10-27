import "dotenv/config";
import { test, expect } from "@playwright/test";
test("production build disables the preview inbox and local environment UI", async ({
  request,
}) => {
  expect(process.env.DATABASE_URL?.startsWith("file:")).toBeTruthy();
  const response = await request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://localhost:3000" },
    data: { email: "host@mehlivo.test", password: "MehlivoLocal!2026" },
  });
  expect(response.ok()).toBeTruthy();
  try {
    const me = await request.get("/api/me");
    expect((await me.json()).local).toBe(false);
    expect((await request.get("/api/inbox")).status()).toBe(404);
    const root = await request.get("/");
    expect(await root.text()).not.toContain("Local test environment");
  } finally {
    await request.post("/api/auth/sign-out", {
      headers: { origin: "http://localhost:3000" },
      data: {},
    });
  }
});

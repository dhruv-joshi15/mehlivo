import { test, expect, APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs/dist/exceljs.min.js");
const db = new PrismaClient();
const password = "LocalTesting!2026";
const suffix = Date.now();
const email = `flow-${suffix}@example.test`;
let event: any;
let first: APIRequestContext;
let second: APIRequestContext;
let guest: APIRequestContext;
let privateToken = "";
let responseToken = "";
let household: any;
let responsePayload: any;
async function ok(r: any) {
  const data = await r.json();
  expect(r.ok(), JSON.stringify(data)).toBeTruthy();
  return data;
}
function response(e: any, extra: any = {}) {
  return {
    version: 0,
    requestKey: crypto.randomUUID(),
    name: "Test family",
    contact: "Test Person",
    email: "",
    phone: "",
    notes: "",
    source: "Guest",
    statuses: e.functions.map((f: any) => ({
      functionId: f.id,
      status: "Attending",
    })),
    members: [
      {
        name: "Test adult",
        category: "Adult",
        diet: "Jain",
        functionIds: e.functions.map((f: any) => f.id),
      },
      {
        name: "Test child",
        category: "Child",
        diet: "Vegetarian",
        functionIds: e.functions.map((f: any) => f.id),
      },
    ],
    ...extra,
  };
}
test.describe.serial("Real SQLite main flows", () => {
  test.beforeAll(async ({ playwright }) => {
    first = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { origin: "http://localhost:3000" },
    });
    second = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { origin: "http://localhost:3000" },
    });
    guest = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { origin: "http://localhost:3000" },
    });
  });
  test.afterAll(async () => {
    await db.user.deleteMany({
      where: { email: { in: [email, `second-${suffix}@example.test`] } },
    });
    await db.emailOutbox.deleteMany({
      where: { recipient: { in: [email, `second-${suffix}@example.test`] } },
    });
    await db.$disconnect();
    await first.dispose();
    await second.dispose();
    await guest.dispose();
  });
  test("signup, verification preview, logout and protected routes", async () => {
    await ok(
      await first.post("/api/auth/sign-up/email", {
        data: { name: "Test host", email, password },
      }),
    );
    const inbox = await ok(await first.get("/api/inbox"));
    expect(
      inbox.some((m: any) => m.outbox.subject.includes("Verify")),
    ).toBeTruthy();
    const verifyUrl = inbox.find((m: any) =>
      m.outbox.subject.includes("Verify"),
    ).outbox.body;
    await first.get(verifyUrl);
    expect(
      (await db.user.findUnique({ where: { email } }))?.emailVerified,
    ).toBeTruthy();
    await ok(await first.post("/api/auth/sign-out", { data: {} }));
    expect((await first.get("/api/events")).status()).toBe(401);
    await ok(
      await first.post("/api/auth/sign-in/email", {
        data: { email, password },
      }),
    );
    await ok(
      await second.post("/api/auth/sign-up/email", {
        data: {
          name: "Second host",
          email: `second-${suffix}@example.test`,
          password,
        },
      }),
    );
  });
  test("create single-function draft then publish multi-function event with themes", async () => {
    const f = {
      name: "Wedding",
      startsAt: "2027-02-19T12:30:00Z",
      venue: "Test Venue",
      address: "Jaipur",
      mapUrl: "https://maps.google.com/",
      themeEnabled: false,
      theme: "Hidden",
      outfit: "Hidden outfit",
      colours: "",
      guidance: "Suggested",
      catering: true,
      currency: "INR",
      adultRate: 10000,
      childRate: null,
      fixed: 1234,
      budget: 50000,
      buffer: 10,
    };
    const draft = await ok(
      await first.post("/api/events", {
        data: {
          type: "Wedding",
          title: `Test event ${suffix}`,
          names: "Test & Host",
          timezone: "Asia/Kolkata",
          welcome: "Welcome",
          expected: 100,
          deadline: null,
          published: false,
          notify: true,
          functions: [f],
        },
      }),
    );
    event = await ok(await first.get("/api/events/" + draft.id));
    expect((await guest.get("/api/public/" + event.id)).status()).toBe(404);
    await ok(
      await first.put("/api/events/" + event.id, {
        data: {
          ...event,
          notify: true,
          published: true,
          functions: [
            event.functions[0],
            {
              ...f,
              name: "Mehndi",
              themeEnabled: true,
              theme: "Pastel Garden",
              outfit: "Wear pastels",
              childRate: 5000,
            },
          ],
        },
      }),
    );
    event = await ok(await first.get("/api/events/" + event.id));
    expect(event.functions).toHaveLength(2);
    const pub = await ok(await guest.get("/api/public/" + event.id));
    expect(pub.functions[0].budget).toBeUndefined();
    expect(
      pub.functions.find((f: any) => !f.themeEnabled).theme,
    ).toBeUndefined();
    expect(pub.functions.find((f: any) => f.themeEnabled).theme).toBe(
      "Pastel Garden",
    );
  });
  test("private household link scopes functions and enforces capacity", async () => {
    const result = await ok(
      await first.post(`/api/events/${event.id}/households`, {
        data: {
          name: "Private family",
          email: "",
          phone: "",
          maxPeople: 1,
          functionIds: [event.functions[0].id],
        },
      }),
    );
    privateToken = result.token;
    household = result.household;
    const own = await ok(await guest.get("/api/response/" + privateToken));
    expect(own.event.functions).toHaveLength(1);
    expect(own.event.functions[0].budget).toBeUndefined();
    expect(own.household.tokens).toBeUndefined();
    const invalid = await guest.post("/api/response/" + privateToken, {
      data: response(own.event),
    });
    expect(invalid.status()).toBe(400);
    const invalidFn = await guest.post("/api/response/" + privateToken, {
      data: response(event, { members: [] }),
    });
    expect(invalidFn.status()).toBe(400);
    const payload = response(own.event);
    payload.members = payload.members.slice(0, 1);
    await ok(
      await guest.post("/api/response/" + privateToken, { data: payload }),
    );
  });
  test("general RSVP retry is idempotent, updates existing record, detects conflicts", async () => {
    responsePayload = response(event);
    const result = await ok(
      await guest.post(`/api/public/${event.id}/respond`, {
        data: responsePayload,
      }),
    );
    responseToken = result.managementToken;
    expect(responseToken.length).toBeGreaterThan(40);
    const retry = await ok(
      await guest.post(`/api/public/${event.id}/respond`, {
        data: responsePayload,
      }),
    );
    expect(retry.id).toBe(result.id);
    expect(retry.managementToken).toBe(responseToken);
    const current = await ok(await guest.get("/api/response/" + responseToken));
    responsePayload = {
      ...responsePayload,
      version: current.household.version,
      notes: "Updated dietary note",
    };
    await ok(
      await guest.post("/api/response/" + responseToken, {
        data: responsePayload,
      }),
    );
    await ok(
      await guest.post("/api/response/" + responseToken, {
        data: responsePayload,
      }),
    );
    const conflict = await guest.post("/api/response/" + responseToken, {
      data: { ...responsePayload, notes: "Stale window edit" },
    });
    expect(conflict.status()).toBe(409);
    const saved = await ok(await guest.get("/api/response/" + responseToken));
    expect(saved.household.history).toHaveLength(2);
    expect(
      await db.household.count({
        where: { requestKey: responsePayload.requestKey },
      }),
    ).toBe(1);
  });
  test("decline and unsure need no members; totals and pending use invitations", async () => {
    for (const status of ["Unable to attend", "Unsure"])
      await ok(
        await guest.post(`/api/public/${event.id}/respond`, {
          data: response(event, {
            name: status,
            members: [],
            statuses: event.functions.map((f: any) => ({
              functionId: f.id,
              status,
            })),
          }),
        }),
      );
    await ok(
      await first.post(`/api/events/${event.id}/households`, {
        data: {
          name: "Pending family",
          email: "",
          phone: "",
          maxPeople: 4,
          functionIds: event.functions.map((f: any) => f.id),
        },
      }),
    );
    const dashboard = await ok(await first.get("/api/events/" + event.id));
    expect(dashboard.metrics.pendingHouseholds).toBe(1);
    expect(dashboard.metrics.invitedPeople).toBe(5);
    expect(dashboard.metrics.invitedHouseholds).toBe(2);
    const t = dashboard.totals[0];
    expect(t.adults).toBe(2);
    expect(t.children).toBe(1);
    expect(t.total).toBe(3);
    expect(t.declined).toBe(1);
    expect(t.unsure).toBe(1);
    expect(t.planningAdults).toBe(3);
    expect(t.planningChildren).toBe(2);
    expect(t.confirmed).toBe(31234);
    expect(t.buffered).toBe(51234);
  });
  test("manual phone correction after deadline, guest deadline protection, no self notification", async () => {
    const latest = await ok(await first.get("/api/events/" + event.id));
    await ok(
      await first.put("/api/events/" + event.id, {
        data: { ...latest, notify: true, deadline: "2020-01-01T00:00:00Z" },
      }),
    );
    expect(
      (
        await guest.post("/api/response/" + responseToken, {
          data: responsePayload,
        })
      ).status(),
    ).toBe(403);
    const privateData = await ok(
      await guest.get("/api/response/" + privateToken),
    );
    const before = await db.emailOutbox.count({ where: { recipient: email } });
    const p = response(privateData.event, {
      version: privateData.household.version,
      source: "Confirmed by phone",
      members: [],
      statuses: [
        {
          functionId: privateData.event.functions[0].id,
          status: "Unable to attend",
        },
      ],
    });
    await ok(
      await first.put(`/api/events/${event.id}/households/${household.id}`, {
        data: p,
      }),
    );
    expect(await db.emailOutbox.count({ where: { recipient: email } })).toBe(
      before,
    );
    const h = await db.household.findUnique({ where: { id: household.id } });
    expect(h?.source).toBe("Confirmed by phone");
    const reopen = await ok(await first.get("/api/events/" + event.id));
    await ok(
      await first.put("/api/events/" + event.id, {
        data: { ...reopen, notify: true, deadline: null },
      }),
    );
  });
  test("CSV and Excel snapshots, escaped text and working budget formulas", async () => {
    const p = response(event, {
      name: '=HYPERLINK("bad")',
      contact: "+Bad",
      members: [],
      statuses: event.functions.map((f: any) => ({
        functionId: f.id,
        status: "Unsure",
      })),
    });
    await ok(await first.post(`/api/events/${event.id}/respond`, { data: p }));
    const csv = await first.get(`/api/events/${event.id}/export?format=csv`);
    expect(csv.ok()).toBeTruthy();
    expect(await csv.text()).toContain("'=HYPERLINK");
    const xlsx = await first.get(`/api/events/${event.id}/export?format=xlsx`);
    expect(xlsx.ok()).toBeTruthy();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await xlsx.body()) as any);
    expect(workbook.worksheets.map((s: any) => s.name)).toEqual([
      "Guest list",
      "Attendance totals",
      "Catering",
    ]);
    const costs = workbook.getWorksheet("Catering");
    const original = (await ok(await first.get("/api/events/" + event.id)))
      .functions[0];
    expect(costs.getCell("F2").value).toBe(original.adultRate / 100);
    expect(costs.getCell("H2").value).toBe(original.fixed / 100);
    expect(costs.getCell("F2").numFmt).toContain("₹");
    expect(costs.getCell("K2").result).toBe(
      costs.getCell("D2").value * costs.getCell("F2").value +
        costs.getCell("E2").value * costs.getCell("G2").value +
        costs.getCell("H2").value,
    );
    expect(costs.getCell("N2").result).toBe(
      costs.getCell("L2").result * costs.getCell("F2").value +
        costs.getCell("M2").result * costs.getCell("G2").value +
        costs.getCell("H2").value,
    );
    expect(workbook.getWorksheet("Catering")?.getCell("N2").formula).toBe(
      "L2*F2+M2*G2+H2",
    );
  });
  test("replace private link invalidates old capability and preserves household responses", async () => {
    const before = await ok(await guest.get("/api/response/" + privateToken));
    const url = `/api/events/${event.id}/households/${household.id}/replace-link`;
    expect((await second.post(url)).status()).toBe(404);
    expect((await guest.post(url)).status()).toBe(401);
    const rotated = await ok(await first.post(url));
    expect(rotated.token).not.toBe(privateToken);
    expect((await guest.get("/api/response/" + privateToken)).status()).toBe(
      404,
    );
    const after = await ok(await guest.get("/api/response/" + rotated.token));
    expect(after.household).toEqual(before.household);
    expect(after.event).toEqual(before.event);
    privateToken = rotated.token;
  });
  test("cross-host and forged household access blocked, notifications deduplicated", async () => {
    for (const url of [
      `/api/events/${event.id}`,
      `/api/events/${event.id}/export?format=csv`,
    ])
      expect((await second.get(url)).status()).toBe(404);
    expect(
      (
        await second.put(`/api/events/${event.id}/households/${household.id}`, {
          data: responsePayload,
        })
      ).status(),
    ).toBe(404);
    expect((await guest.get("/api/response/not-a-token")).status()).toBe(404);
    const scoped = await ok(
      await guest.post("/api/response/" + responseToken, {
        data: { ...responsePayload, householdId: household.id },
      }),
    );
    expect(scoped.id).not.toBe(household.id);
    expect(
      (await db.household.findUniqueOrThrow({ where: { id: household.id } }))
        .source,
    ).toBe("Confirmed by phone");
    const inbox = await ok(await first.get("/api/inbox"));
    const keys = inbox.map((m: any) => m.outbox.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((s: string) => s.startsWith("response:"))).toHaveLength(
      5,
    );
  });
  test("password reset message, new password and old session revoked", async () => {
    await ok(
      await guest.post("/api/auth/request-password-reset", {
        data: { email, redirectTo: "http://localhost:3000/reset-password" },
      }),
    );
    const mail = await db.emailOutbox.findFirstOrThrow({
      where: { recipient: email, subject: "Reset your Mehlivo password" },
      orderBy: { createdAt: "desc" },
    });
    const url = new URL(mail.body);
    let resetToken = url.searchParams.get("token");
    if (!resetToken) {
      const page = await guest.get(mail.body, { maxRedirects: 0 });
      const redirect = page.headers()["location"];
      resetToken = new URL(redirect).searchParams.get("token");
    }
    expect(resetToken).toBeTruthy();
    await ok(
      await guest.post("/api/auth/reset-password", {
        data: { token: resetToken, newPassword: password + "New" },
      }),
    );
    expect((await first.get("/api/events")).status()).toBe(401);
    expect(
      (
        await first.post("/api/auth/sign-in/email", {
          data: { email, password },
        })
      ).ok(),
    ).toBeFalsy();
    await ok(
      await first.post("/api/auth/sign-in/email", {
        data: { email, password: password + "New" },
      }),
    );
  });
  test("browser host and invitation render, responsive layout and safe deletion", async ({
    page,
  }) => {
    await page.context().addCookies((await first.storageState()).cookies);
    await page.goto("/host");
    await expect(
      page.getByRole("heading", { name: "Hello, Test host." }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: new RegExp(`Test event ${suffix}`) })
      .click();
    await page.getByRole("button", { name: "Guests", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Households & guests" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "test-results/mobile-dashboard.png",
      fullPage: true,
    });
    await page.goto("/invite/" + event.id);
    await expect(
      page.getByRole("heading", { name: "The schedule" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your household response" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/mobile-invitation.png",
      fullPage: true,
    });
    expect(
      (
        await first.delete("/api/events/" + event.id, {
          data: { confirm: "wrong" },
        })
      ).status(),
    ).toBe(400);
    await ok(
      await first.delete("/api/events/" + event.id, {
        data: { confirm: event.title },
      }),
    );
    expect((await guest.get("/api/public/" + event.id)).status()).toBe(404);
  });
});

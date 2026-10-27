import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
test("celebration screens at four widths, keyboard, reduced motion and guided validation", async ({
  page,
}) => {
  test.setTimeout(180000);
  const email = `visual-${Date.now()}@example.test`;
  const title =
    "Ananya & Aarav · A beautiful celebration with our families and friends";
  const shot = async (name: string, width: number) => {
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name + " overflow",
    ).toBeTruthy();
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      );
    });
    await page.screenshot({
      path: `test-results/visual/${width}-${name}.png`,
      fullPage: true,
    });
  };
  try {
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, name] of [
        ["/", "home"],
        ["/login", "login"],
        ["/signup", "signup"],
        ["/demo", "demo"],
      ]) {
        await page.goto(path);
        await shot(name, width);
      }
    }
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".landing-hero")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const sign = await page.request.post("/api/auth/sign-up/email", {
      data: { name: "Visual Host", email, password: "VisualLocal!2026" },
    });
    expect(sign.ok()).toBeTruthy();
    const f = {
      name: "Wedding",
      startsAt: "2027-04-12T12:30:00Z",
      venue:
        "The Rose Courtyard · A very long venue name for a wonderful family celebration",
      address: "Jaipur, Rajasthan",
      mapUrl: "",
      themeEnabled: true,
      theme: "Pastels",
      outfit: "Wear your favourite pastel Indian outfit.",
      colours: "Peach, lilac, mint",
      guidance: "Suggested",
      catering: true,
      currency: "INR",
      adultRate: 75000,
      childRate: 37500,
      fixed: 1234,
      budget: 2000000,
      buffer: 10,
    };
    const created = await page.request.post("/api/events", {
      data: {
        type: "Wedding",
        title,
        names: "Ananya & Aarav",
        timezone: "Asia/Kolkata",
        welcome: "A new chapter, with you in it.",
        expected: 0,
        deadline: null,
        published: true,
        notify: false,
        functions: [f, { ...f, name: "Mehndi" }],
      },
    });
    expect(created.ok()).toBeTruthy();
    const event = await created.json();
    const detail = await (
      await page.request.get("/api/events/" + event.id)
    ).json();
    const invited = await page.request.post(
      `/api/events/${event.id}/households`,
      {
        data: {
          name: "The extraordinarily lovely Sharma and Srinivasan family",
          email: "",
          phone: "",
          maxPeople: 4,
          functionIds: detail.functions.map((f: any) => f.id),
        },
      },
    );
    expect(invited.ok()).toBeTruthy();
    const invitation = await invited.json();
    const privatePath = "/response/" + invitation.token;
    // Declining every function skips the member step and stores no invented counts.
    await page.goto(privatePath);
    await page
      .getByLabel("Main contact name", { exact: true })
      .fill("A very long contact name for the Sharma family");
    for (const name of ["Wedding", "Mehndi"])
      await page
        .getByLabel("Attendance for " + name)
        .selectOption("Unable to attend");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Save response", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save response", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your saved response" }),
    ).toBeVisible();
    const saved = await (
      await page.request.get("/api/response/" + invitation.token)
    ).json();
    expect(saved.household.members).toHaveLength(0);
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/host");
      await expect(
        page.getByRole("heading", { name: "Hello, Visual Host." }),
      ).toBeVisible();
      await shot("events", width);
      await page.goto(`/host/events/${event.id}`);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      for (const name of [
        "Overview",
        "Guests",
        "Invitation",
        "Budget",
        "Settings",
      ]) {
        await page.getByRole("button", { name, exact: true }).click();
        await shot("dashboard-" + name, width);
      }
      await page.getByRole("button", { name: "Guests", exact: true }).click();
      await page
        .getByRole("button", { name: "Replace private link", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot("replace-dialog", width);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.goto(`/host/events/${event.id}/edit`);
      await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(
        title,
      );
      await shot("setup-occasion", width);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await shot("setup-details", width);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await shot("setup-preview", width);
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(
        page.getByLabel("Venue name", { exact: true }).first(),
      ).toHaveValue(f.venue);
      await page.goto("/invite/" + event.id);
      await expect(
        page.getByRole("heading", { name: "The schedule" }),
      ).toBeVisible();
      await shot("invitation-rsvp", width);
      await page.goto(privatePath);
      await expect(
        page.getByRole("heading", { name: "Your saved response" }),
      ).toBeVisible();
      await shot("thank-you", width);
      await page
        .getByRole("button", { name: "Update my response", exact: true })
        .click();
      await shot("response-edit", width);
    }
    await page.goto("/host/events/new");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Event title", { exact: true })).toBeVisible();
    expect(
      await page
        .getByLabel("Event title", { exact: true })
        .evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBe(false);
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.emailOutbox.deleteMany({ where: { recipient: email } });
    await db.$disconnect();
  }
});

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
test("browser signup, event editor, private guest RSVP and response update", async ({
  page,
  browser,
}) => {
  const email = `ui-${Date.now()}@example.test`;
  const title = "Browser test celebration";
  const guest = await browser.newContext();
  const gp = await guest.newPage();
  try {
    await page.goto("/signup");
    await page.getByLabel("Your name", { exact: true }).fill("Browser Host");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password (at least 10 characters)")
      .fill("BrowserLocal!2026");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Create your first event" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Create your first event", exact: true })
      .click();
    await page
      .getByLabel("Host / couple / celebrant names")
      .fill("Browser Host");
    await page.getByLabel("Event title", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByLabel("Date & time (Asia/Kolkata)")
      .fill("2027-04-12T18:00");
    await page
      .getByLabel("Venue name", { exact: true })
      .fill("Local Test Hall");
    await page.getByLabel("Add a theme or dress code").check();
    await page.getByLabel("Theme name", { exact: true }).fill("Pastel Garden");
    await page.getByLabel("Outfit instructions").fill("Wear pastels.");
    await page.getByLabel("Add catering estimates").check();
    await page.getByLabel("Adult price per plate").fill("500");
    await page.getByLabel("Buffer percentage (0–100)").fill("10");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Venue name", { exact: true })).toHaveValue(
      "Local Test Hall",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Finish setup", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Publish invitation (free in local testing)").check();
    const savedResponse = page.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes("/api/events/"),
    );
    await page.getByRole("button", { name: "Save & publish" }).click();
    const saved = await savedResponse;
    expect(saved.request().postDataJSON().published).toBe(true);
    expect(saved.ok()).toBeTruthy();
    await page.getByRole("button", { name: "Invitation", exact: true }).click();
    await expect(page.getByLabel("General invitation link")).toBeVisible();
    await page.getByRole("button", { name: "Guests", exact: true }).click();
    await page
      .getByRole("button", { name: "Add household invitation", exact: true })
      .click();
    await page
      .getByLabel("Household / family name", { exact: true })
      .fill("Browser family");
    await page.getByLabel("Maximum invited people").fill("2");
    await page
      .getByRole("button", { name: "Create private invitation", exact: true })
      .click();
    const link = await page
      .getByLabel("Private household link", { exact: true })
      .inputValue();
    await gp.goto(link);
    await expect(
      gp.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await gp
      .getByLabel("Main contact name", { exact: true })
      .fill("Browser Guest");
    await gp.getByLabel("Attendance for Celebration").selectOption("Attending");
    await gp.getByRole("button", { name: "Continue", exact: true }).click();
    await gp
      .getByRole("button", {
        name: "+ Add family member / yourself",
        exact: true,
      })
      .click();
    await gp.getByLabel("Member name", { exact: true }).fill("Browser Guest");
    await gp.getByRole("button", { name: "Continue", exact: true }).click();
    await gp
      .getByRole("button", { name: "Save response", exact: true })
      .click();
    await expect(
      gp.getByRole("heading", { name: "Your saved response", exact: true }),
    ).toBeVisible();
    await expect(
      gp.getByText("Thank you, Browser family! Your response has been saved."),
    ).toBeVisible();
    await gp
      .getByRole("button", { name: "Update my response", exact: true })
      .click();
    await gp.getByRole("button", { name: "Continue", exact: true }).click();
    await gp
      .getByRole("button", {
        name: "+ Add family member / yourself",
        exact: true,
      })
      .click();
    await gp
      .getByLabel("Member name", { exact: true })
      .nth(1)
      .fill("Browser Child");
    await gp
      .getByRole("group", { name: "Member 2", exact: true })
      .getByRole("combobox")
      .first()
      .selectOption("Child");
    await gp.getByRole("button", { name: "Continue", exact: true }).click();
    await gp
      .getByRole("button", { name: "Save response changes", exact: true })
      .click();
    await expect(
      gp.getByText("Total attending, including you: 2", { exact: true }),
    ).toBeVisible();
    await gp.screenshot({
      path: "test-results/guest-response.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByText("1 adults · 1 children", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("₹1,000.00", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/desktop-dashboard.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Guests", exact: true }).click();
    await page
      .getByRole("button", { name: "View / edit", exact: true })
      .click();
    await page.getByLabel("Response source").selectOption("Confirmed by phone");
    await page.getByLabel("Notes (optional)").fill("Confirmed over a call");
    await page
      .getByRole("button", { name: "Save response changes", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: /Confirmed by phone/ }),
    ).toBeVisible();
    await page.getByText("Account", { exact: true }).click();
    await page
      .getByRole("link", { name: "Development inbox", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Development inbox", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Development preview — not delivered", { exact: true })
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password (at least 10 characters)")
      .fill("BrowserLocal!2026");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Hello, Browser Host.", exact: true }),
    ).toBeVisible();
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.emailOutbox.deleteMany({ where: { recipient: email } });
    await db.$disconnect();
  }
});

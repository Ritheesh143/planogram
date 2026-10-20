import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, context }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Record window.open instead of leaving the site.
  await page.addInitScript(() => {
    (window as unknown as { opened: string[] }).opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { opened: string[] }).opened.push(String(url));
      return null;
    };
  });
});

test("Ask Claude copies a prompt with the lesson, section and question, and opens claude.ai", async ({ page }) => {
  await page.goto("/learn/foundations/counting-worlds");
  await page.getByRole("button", { name: "Ask Claude about Do It by Hand" }).click();
  await expect(page.locator("#ask-section")).toHaveValue("hand");
  await expect(page.locator("#ask-question")).toBeFocused();
  await page.locator("#ask-question").fill("Why is it only 15%?");
  await page.getByRole("button", { name: "Copy prompt and open Claude" }).click();
  await expect(page.getByRole("status")).toHaveText(/Copied/);

  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("Counting Worlds");
  expect(clip).toContain("I'm in the section: Do It by Hand");
  expect(clip).toContain("My question: Why is it only 15%?");
  expect(clip).toContain("About 15%. Out of 1,000 returns");
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(["https://claude.ai/new"]);
});

test("Ask Claude is on model pages too", async ({ page }) => {
  await page.goto("/models/linear-regression");
  await expect(page.getByText("Ask Claude about this model")).toBeVisible();
  await page.locator("#ask-section").selectOption("failure");
  await page.getByRole("button", { name: "Copy prompt and open Claude" }).click();
  await expect(page.getByRole("status")).toHaveText(/Copied/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("I'm in the section: Failure Lab");
});

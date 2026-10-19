import { expect, test, type Page } from "@playwright/test";

const setRange = (page: Page, id: string, value: number) =>
  page.locator(`#${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("home shows the keystones and the store map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start here: the four Keystones" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Store floor plan/ })).toBeVisible();
  await page.getByRole("link", { name: /KEYSTONE 1/ }).click();
  await expect(page).toHaveURL(/counting-worlds/);
});

test("counting worlds: sliders change the counts", async ({ page }) => {
  await page.goto("/learn/foundations/counting-worlds");
  const answer = page.getByTestId("cw-answer");
  await expect(answer).toContainText("9 of 59");
  await setRange(page, "cw-base", 0.1);
  await expect(answer).toContainText("90 of 135");
  await page.getByRole("button", { name: "Show only flagged returns" }).click();
  await expect(page.getByRole("button", { name: "Show all returns" })).toBeVisible();
});

test("CI repeat: running total accumulates", async ({ page }) => {
  await page.goto("/learn/foundations/ci-repeat");
  await expect(page.getByTestId("ci-covered")).toContainText("of 100 caught the truth");
  await page.getByRole("button", { name: "Run 1,000 more and just count" }).click();
  await expect(page.getByTestId("ci-running")).toContainText("of 1,100");
});

test("likelihood dial: the peak follows the average", async ({ page }) => {
  await page.goto("/learn/foundations/likelihood-dial");
  await expect(page.getByRole("img", { name: /peak at lambda equals 1.00/ })).toBeVisible();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Day 3 plus one" }).click();
  await expect(page.getByTestId("ld-day-2")).toHaveText("7");
  await expect(page.getByRole("img", { name: /peak at lambda equals 3.00/ })).toBeVisible();
});

test("boosting by hand: round 2 matches the worked example", async ({ page }) => {
  await page.goto("/learn/models/boosting-by-hand");
  await expect(page.getByTestId("bh-sse")).toContainText("Round 1: 494");
  await page.getByRole("button", { name: "Next round →" }).click();
  await expect(page.getByTestId("bh-sse")).toContainText("Round 2: 221.75");
  await expect(page.getByTestId("bh-table")).toContainText("32.25");
});

test("depth toggle hides and shows derivations; solutions reveal", async ({ page }) => {
  await page.goto("/learn/foundations/counting-worlds");
  await expect(page.getByText("The odds form: Bayes in your head")).toBeVisible();
  await page.getByRole("radio", { name: "L1 Intuition" }).click();
  await expect(page.getByText("The odds form: Bayes in your head")).toBeHidden();
  await page.getByRole("button", { name: /The odds shortcut that interviewers love/ }).click();
  await expect(page.getByText("The odds form: Bayes in your head")).toBeVisible();

  const first = page.locator("details", { hasText: "Show worked solution" }).first();
  await first.locator("summary").click();
  await expect(first.getByText("120 / 400")).toBeVisible();
});

test("flashcards flow from a lesson into review", async ({ page }) => {
  await page.goto("/learn/foundations/likelihood-dial");
  await page.getByRole("button", { name: /Add 5 cards to my review deck/ }).click();
  await expect(page.getByText("All 5 cards are in your review deck")).toBeVisible();

  await page.goto("/review");
  await expect(page.getByTestId("due-count")).toHaveText("5");
  await page.getByRole("button", { name: "Show answer" }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByTestId("due-count")).toHaveText("4");
});

test("floor check scores and routes misconceptions", async ({ page }) => {
  await page.goto("/check");
  const questions = page.locator("fieldset");
  const n = await questions.count();
  for (let i = 0; i < n; i++) {
    // Pick "Not sure" where offered, otherwise the first option.
    const q = questions.nth(i);
    const unsure = q.getByLabel("Not sure", { exact: true });
    if (await unsure.count()) await unsure.check();
    else await q.locator("input").first().check();
  }
  await page.getByRole("button", { name: "See my floor" }).click();
  const result = page.getByTestId("check-result");
  await expect(result).toContainText(`0 of ${n}`);
  await expect(result.getByRole("link", { name: /Fix it in: Boosting by Hand/ })).toBeVisible();
  await expect(page.getByText("Your Floor Check history")).toBeVisible();
});

test("planned lessons render a placeholder", async ({ page }) => {
  await page.goto("/learn/bayes/posterior-grid");
  await expect(page.getByText(/This bay is still being stocked/)).toBeVisible();
  await page.goto("/models/gradient-boosting");
  await expect(page.getByRole("heading", { name: "Gradient Boosting, End to End" })).toBeVisible();
});

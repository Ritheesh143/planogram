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

test("linear regression: the hand-worked line scores 14, and gradient descent finds it", async ({ page }) => {
  await page.goto("/models/linear-regression");
  await expect(page.getByText("MODEL LAB", { exact: true })).toBeVisible();
  await expect(page.getByTestId("lr-sse")).toHaveText("74");
  await expect(page.getByTestId("lr-best")).toContainText("ŷ = 100 − 8·price, error 14");
  await setRange(page, "lr-a", 100);
  await setRange(page, "lr-b", -8);
  await expect(page.getByTestId("lr-sse")).toHaveText("14");
  await setRange(page, "lr-a", 90);
  await setRange(page, "lr-b", -6);
  await page.getByRole("button", { name: "Roll downhill (gradient descent)" }).click();
  await expect(page.getByRole("button", { name: "Roll downhill (gradient descent)" })).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByTestId("lr-sse")).toHaveText(/^14(\.0)?$/);
});

test("linear regression: lasso zeroes a coefficient; collinearity widens the cloud", async ({ page }) => {
  await page.goto("/models/linear-regression");
  await expect(page.getByTestId("rl-coef")).toContainText("facings 0");
  await setRange(page, "rl-strength", 0);
  await expect(page.getByTestId("rl-coef")).toContainText("facings 2.47");
  const spread = async () => Number((await page.getByTestId("cc-spread").textContent())!.replace("±", ""));
  await setRange(page, "cc-alike", 0);
  const tight = await spread();
  await setRange(page, "cc-alike", 4);
  expect(await spread()).toBeGreaterThan(20 * tight);
});

test("failure lab: switching scenarios trains all four models", async ({ page }) => {
  await page.goto("/models/linear-regression");
  await page.getByTestId("fl-scenario-trend").click();
  await expect(page.getByTestId("fl-test-linear")).toContainText("✓ best", { timeout: 15_000 });
  await page.getByTestId("fl-scenario-step").click();
  await expect(page.getByTestId("fl-test-tree")).toContainText("✓ best", { timeout: 15_000 });
});

test("decision tree: the tier split gains 5,880 and pruning sliders respond", async ({ page }) => {
  await page.goto("/models/decision-tree");
  await page.getByRole("radio", { name: "Split on city tier" }).click();
  await expect(page.getByTestId("ts-gain")).toHaveText("5880");
  await expect(page.getByText("✓ The best split of all.")).toBeVisible();
  await setRange(page, "td-depth", 10);
  await expect(page.getByTestId("td-test")).toHaveText("11.8");
  await setRange(page, "td-minleaf", 5);
  await expect(page.getByTestId("td-test")).toHaveText("10.7");
  await setRange(page, "bag-count", 50);
  await expect(page.getByTestId("bag-test")).toHaveText("9.78");
});

test("MLE rung: each noise model bottoms out at its own summary", async ({ page }) => {
  await page.goto("/learn/bayes/mle-peak");
  await expect(page.getByTestId("lm-argmin")).toHaveText("4");
  await page.getByRole("radio", { name: /Laplace noise/ }).click();
  await expect(page.getByTestId("lm-argmin")).toHaveText("3");
  await page.getByLabel(/Add a 15-unit spike day/).check();
  await expect(page.getByTestId("lm-argmin")).toHaveText("anywhere from 3 to 7");
  await expect(page.getByTestId("ls-median")).toHaveText("0");
  await expect(page.getByTestId("ls-p90")).toHaveText("6");
});

test("gradient boosting: absolute loss lands on 20 and 33; λ helps the knobs playground", async ({ page }) => {
  await page.goto("/models/gradient-boosting");
  await setRange(page, "fs-round", 1);
  await expect(page.getByTestId("fs-pred")).toHaveText("20, 20, 20, 33, 33, 33");
  await page.getByRole("radio", { name: "Poisson" }).click();
  await expect(page.getByTestId("fs-pred")).toHaveText("21.81, 21.81, 21.81, 35.95, 35.95, 35.95");
  await expect(page.getByTestId("gk-test")).toHaveText("10.3");
  await setRange(page, "gk-lambda", 20);
  await expect(page.getByTestId("gk-test")).toHaveText("8.9");
});

test("XGBoost vs LightGBM vs CatBoost: histograms, growth order and leakage", async ({ page }) => {
  await page.goto("/models/xgb-lgbm-catboost");
  await expect(page.getByTestId("hs-gain")).toHaveText("420.50");
  await setRange(page, "lvl-leaves", 16);
  await expect(page.getByTestId("lvl-depth")).toHaveText("5");
  await expect(page.getByTestId("tl-naive")).toHaveText("75%");
  await expect(page.getByTestId("tl-ordered")).toHaveText("47%");
});

test("MLP: one backprop step, the kink by hand, and the scaling trap", async ({ page }) => {
  await page.goto("/models/mlp");
  await expect(page.getByTestId("bp-pred")).toHaveText("9");
  await page.getByRole("button", { name: "Take one gradient step" }).click();
  await expect(page.getByTestId("bp-pred")).toHaveText("9.714");
  await setRange(page, "rk-k1", 4);
  await setRange(page, "rk-s1", 9);
  await expect(page.getByTestId("rk-sse")).toHaveText("106.4");
  await expect(page.getByTestId("mt-test")).toHaveText("2.15", { timeout: 15_000 });
  await page.getByTestId("mt-scale").uncheck();
  await expect(page.getByTestId("mt-test")).toHaveText("19.67", { timeout: 15_000 });
});

test("tree vs MLP: bends win the diagonal, boxes win the thresholds", async ({ page }) => {
  await page.goto("/learn/models/tree-vs-mlp");
  await expect(page.getByTestId("bb-tree")).toHaveText("9.7", { timeout: 15_000 });
  await expect(page.getByTestId("bb-mlp")).toHaveText("4.9");
  await page.getByRole("radio", { name: "Jumps at thresholds" }).click();
  await setRange(page, "bb-depth", 3);
  await expect(page.getByTestId("bb-tree")).toHaveText("5.8", { timeout: 15_000 });
});

test("model arena: the failure matrix opens each cell", async ({ page }) => {
  await page.goto("/models/model-arena");
  await expect(page.getByTestId("fm-baseline-lgbm_tweedie")).toHaveText("best");
  await page.getByTestId("fm-big_stores-lgbm").click();
  await expect(page.getByTestId("fm-detail")).toContainText("LightGBM: WAPE 0.220, bias -10.0%");
  await page.getByTestId("fm-ids_only-tree").click();
  await expect(page.getByTestId("fm-detail")).toContainText("Decision tree: WAPE 0.448");
  await expect(page.getByTestId("ac-rises-ridge")).toHaveText("0% of promo weeks");
});

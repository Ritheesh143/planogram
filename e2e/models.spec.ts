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

test("plan: start the sprint, tick a task and log hours", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.getByTestId("plan-week")).toHaveText("Not started");
  await page.getByRole("button", { name: "Start today" }).click();
  await expect(page.getByTestId("plan-week")).toHaveText("1 of 16");
  await page.getByTestId("plan-task-w1-check").check();
  await expect(page.getByTestId("plan-week-1")).toContainText("1/6 done");
  await page.getByTestId("plan-hours-input").fill("2.5");
  await page.getByRole("button", { name: "Log hours" }).click();
  await expect(page.getByTestId("plan-hours")).toHaveText("2.5");
  await page.reload();
  await expect(page.getByTestId("plan-hours")).toHaveText("2.5");
});

test("exercises, graph and threads pages work", async ({ page }) => {
  await page.goto("/exercises");
  await expect(page.getByTestId("ex-done")).toContainText("0 of");
  await page.getByTestId("ex-counting-worlds-1").check();
  await expect(page.getByTestId("ex-done")).toContainText("1 of");
  await page.goto("/graph");
  await page.getByTestId("graph-node-gradient-boosting").hover();
  await expect(page.getByText("needs 2 lessons before it")).toBeVisible();
  await page.goto("/threads");
  await expect(page.getByTestId("thread-likelihood-loss")).toContainText("MLE and Losses as Negative Log-Likelihood");
});

test("navigation: More menu on desktop, Menu on mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByText("More ▾").click();
  await page.getByRole("link", { name: "Concept Graph" }).click();
  await expect(page).toHaveURL(/\/graph/);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.getByTestId("mobile-menu").click();
  await page.getByTestId("mobile-menu").locator("..").getByRole("link", { name: "Plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plan/);
});

test("gamma-Poisson: three days give Gamma(5, 4); ten more days tighten it", async ({ page }) => {
  await page.goto("/learn/bayes/gamma-poisson");
  await expect(page.getByTestId("gp-post")).toHaveText("Gamma(5, 4)");
  await expect(page.getByTestId("gp-mean")).toHaveText("1.25");
  await expect(page.getByTestId("gp-interval")).toHaveText("0.49 to 2.29");
  await expect(page.getByTestId("gp-p0")).toHaveText("0.328");
  await expect(page.getByTestId("gp-pge3")).toHaveText("0.148");
  await expect(page.getByTestId("gp-p95")).toHaveText("4");
  for (let i = 0; i < 10; i++) await page.getByRole("button", { name: "Add a day selling 1" }).click();
  await expect(page.getByTestId("gp-post")).toHaveText("Gamma(15, 14)");
  await expect(page.getByTestId("gp-mean")).toHaveText("1.07");
  await expect(page.getByTestId("gp-ratio")).toHaveText("1.88");
  await setRange(page, "gp-k", 5);
  await expect(page.getByTestId("gp-ratio")).toHaveText("1.00");
});

test("priors: the vague prior implies absurd stores; priors wash out", async ({ page }) => {
  await page.goto("/learn/bayes/priors-defend");
  await expect(page.getByTestId("pd-p95")).toHaveText("13.9 million");
  await expect(page.getByTestId("pd-p99")).toHaveText("12.7 billion");
  await expect(page.getByTestId("pd-absurd")).toHaveText("24.5%");
  await page.getByRole("button", { name: /Weakly informative/ }).click();
  await expect(page.getByTestId("pd-p95")).toHaveText("10.4");
  await expect(page.getByTestId("pd-absurd")).toHaveText("essentially none");
  await expect(page.getByTestId("pd-wash")).toHaveText("3.08, 1.56, 0.88");
  await setRange(page, "pd-days", 90);
  await expect(page.getByTestId("pd-wash")).toHaveText("1.76, 1.55, 1.44");
  await expect(page.getByTestId("pd-world")).toHaveText("0.72");
  await expect(page.getByTestId("pd-lift")).toHaveText("7.20%");
});

test("posterior grid: priors disagree, then the data win", async ({ page }) => {
  await page.goto("/learn/bayes/posterior-grid");
  await expect(page.getByTestId("pg-mean")).toHaveText("1.33");
  await expect(page.getByTestId("pg-interval")).toHaveText("0.5 and 2.6");
  await page.getByRole("radio", { name: /Manager's hunch/ }).click();
  await expect(page.getByTestId("pg-mean")).toHaveText(/^2(\.00)?$/);
  await setRange(page, "pg-extra", 27);
  await expect(page.getByTestId("pg-mean")).toHaveText("1.42");
  await expect(page.getByTestId("pg-coverage")).toHaveText("904 of 1,000", { timeout: 15_000 });
  await page.getByRole("radio", { name: /Confident and wrong/ }).click();
  await expect(page.getByTestId("pg-coverage")).toHaveText("67 of 1,000", { timeout: 15_000 });
});

test("beta-binomial: counts in, posterior out", async ({ page }) => {
  await page.goto("/learn/bayes/beta-binomial");
  await expect(page.getByTestId("bb-post")).toHaveText("Beta(5, 15)");
  await expect(page.getByTestId("bb-mean")).toHaveText("0.250");
  await expect(page.getByTestId("bb-interval")).toHaveText("0.110 to 0.419");
  await page.getByRole("button", { name: "Next shopper buys" }).click();
  await expect(page.getByTestId("bb-post")).toHaveText("Beta(6, 15)");
  await page.getByRole("button", { name: "No shoppers yet" }).click();
  await expect(page.getByTestId("bb-mean")).toHaveText("0.200");
  await page.getByRole("button", { name: "Back to the 10 shoppers" }).click();
  await setRange(page, "bb-strength", 5);
  await expect(page.getByTestId("bb-post")).toHaveText("Beta(23, 87)");
  await expect(page.getByTestId("bb-sim-raw")).toHaveText("9.2");
  await expect(page.getByTestId("bb-sim-post")).toHaveText("6.7");
  await expect(page.getByTestId("bb-sim-cover")).toHaveText("89.9%");
});

test("math toolkit: bars converge, cosine ignores contractors, tables multiply", async ({ page }) => {
  await page.goto("/learn/foundations/integrals-thin-bars");
  await expect(page.getByTestId("br-sum")).toHaveText("0.7500");
  await expect(page.getByTestId("tb-prob")).toHaveText("0.7249");
  await setRange(page, "tb-n", 5);
  await expect(page.getByTestId("tb-prob")).toHaveText("0.7178");
  await expect(page.getByTestId("mc-est")).toHaveText("0.8100");
  await page.getByRole("button", { name: "Throw 900 more" }).click();
  await expect(page.getByTestId("mc-est")).toHaveText("0.7785");
  await page.goto("/learn/foundations/vectors-baskets");
  await expect(page.getByTestId("bp-cos")).toHaveText("0.949");
  await page.getByTestId("bp-contractor").check();
  await expect(page.getByTestId("bp-dot")).toHaveText("18");
  await expect(page.getByTestId("bp-cos")).toHaveText("0.949");
  await expect(page.getByTestId("bs-dot-contractors")).toHaveText("10");
  await expect(page.getByTestId("bs-cos-contractors")).toHaveText("0");
  await page.goto("/learn/foundations/matrices-tables");
  await expect(page.getByTestId("st-rev-0")).toHaveText("₹29,500");
  await page.getByTestId("st-u-2-2").fill("10");
  await expect(page.getByTestId("st-rev-2")).toHaveText("₹45,750");
  await expect(page.getByTestId("ps-mean")).toHaveText("₹1,02,891");
});

test("shrinkage: two weeks get a third of the weight", async ({ page }) => {
  await page.goto("/learn/bayes/shrinkage");
  await expect(page.getByTestId("sh-weight")).toHaveText("33%");
  await expect(page.getByTestId("sh-post")).toHaveText("43.33");
  await setRange(page, "sh-weeks", 8);
  await expect(page.getByTestId("sh-weight")).toHaveText("67%");
  await expect(page.getByTestId("sh-post")).toHaveText("36.67");
  await expect(page.getByTestId("sh-raw-sse")).toHaveText("3,574");
  await expect(page.getByTestId("sh-shrunk-sse")).toHaveText("1,026");
  await expect(page.getByTestId("sh-wins")).toHaveText("992 of 1,000");
});

test("Bayesian regression: the posterior slope is the ridge slope; wrong priors don't cover", async ({ page }) => {
  await page.goto("/learn/bayes/bayes-linreg");
  await expect(page.getByTestId("bl-mean")).toHaveText("-4.00");
  await expect(page.getByTestId("bl-sd")).toHaveText("0.45");
  await expect(page.getByTestId("bl-lambda")).toHaveText("10");
  await page.getByRole("radio", { name: "flat (no prior)" }).click();
  await expect(page.getByTestId("bl-mean")).toHaveText("-8.00");
  await expect(page.getByTestId("bl-sd")).toHaveText("0.63");
  await expect(page.getByTestId("bl-coverage")).toHaveText("90.3%");
  await page.getByRole("radio", { name: "Confident prior, wrong world" }).click();
  await expect(page.getByTestId("bl-coverage")).toHaveText("0.0%");
});

test("hierarchical pooling: partial pooling cuts the error by two-thirds", async ({ page }) => {
  await page.goto("/learn/bayes/hierarchical-pooling");
  await expect(page.getByTestId("hp-mse-none")).toHaveText("89.3");
  await expect(page.getByTestId("hp-mse-complete")).toHaveText("81.3");
  await expect(page.getByTestId("hp-mse-partial")).toHaveText("29.3");
  await expect(page.getByTestId("hp-tau")).toHaveText("10.1");
  await expect(page.getByTestId("hp-tau-peak")).toHaveText("8.9");
  await expect(page.getByTestId("hp-study-partial")).toHaveText("37.3");
});

test("why sample: a bigger bag gets closer to the exact answers", async ({ page }) => {
  await page.goto("/learn/bayes/why-sample");
  await expect(page.getByTestId("bag-p")).toHaveText("0.300");
  await setRange(page, "bag-size", 7);
  await expect(page.getByTestId("bag-mean")).toHaveText("0.249");
  await expect(page.getByTestId("bag-p")).toHaveText("0.281");
  await expect(page.getByTestId("bag-lo")).toHaveText("0.110");
  await expect(page.getByTestId("bag-spread-4000")).toHaveText("0.0071");
});

test("MCMC: step size, diagnostics and divergences", async ({ page }) => {
  await page.goto("/learn/bayes/mcmc-walker");
  await expect(page.getByTestId("mw-accept")).toHaveText("34.6%");
  await expect(page.getByTestId("mw-ess")).toHaveText("739");
  await page.getByRole("radio", { name: "Tiny steps (0.01)" }).click();
  await expect(page.getByTestId("mw-accept")).toHaveText("96.5%");
  await expect(page.getByTestId("mw-ess")).toHaveText("15");
  await expect(page.getByTestId("cd-rhat")).toHaveText("1.004");
  await page.getByRole("radio", { name: "Too timid" }).click();
  await expect(page.getByTestId("cd-rhat")).toHaveText("9.223");
  await expect(page.getByTestId("ss-ess-0.3")).toHaveText("778");
  await expect(page.getByTestId("rb-div")).toHaveText("0");
  await expect(page.getByTestId("rb-jump")).toHaveText("1.87");
  await setRange(page, "rb-eps", 0.45);
  await expect(page.getByTestId("rb-div")).toHaveText("464");
});

test("Bayesian A/B: P(B > A) by counting, and the cost of peeking", async ({ page }) => {
  await page.goto("/learn/bayes/bayes-ab");
  await expect(page.getByTestId("ab-p")).toHaveText("92.4%");
  await expect(page.getByTestId("ab-exact")).toHaveText("92.7%");
  await expect(page.getByTestId("ab-loss-b")).toHaveText("0.029");
  await setRange(page, "ab-buys-b", 48);
  await expect(page.getByTestId("ab-p")).toHaveText("49.5%");
  await expect(page.getByTestId("pk-28")).toHaveText("22.6%");
  await page.getByRole("radio", { name: "Look once, at day 28" }).click();
  await expect(page.getByTestId("pk-drawn")).toHaveText("1");
});

test("MMM bridge: priors and a lift test pick the point on the ridge", async ({ page }) => {
  await page.goto("/learn/bayes/bayes-mmm-bridge");
  await expect(page.getByTestId("mm-corr")).toHaveText("0.95");
  await expect(page.getByTestId("mm-tv")).toHaveText("-0.49");
  await expect(page.getByTestId("mm-p0")).toHaveText("63.2%");
  await page.getByRole("radio", { name: "Positive + TV lift test" }).click();
  await expect(page.getByTestId("mm-tv")).toHaveText("1.29");
  await expect(page.getByTestId("mm-p1")).toHaveText("85.3%");
  await expect(page.getByTestId("ms-ols")).toHaveText("1.35");
  await expect(page.getByTestId("ms-neg")).toHaveText("13.5%");
});

test("Forecasting anatomy: the moving average, the ACF and noise spikes", async ({ page }) => {
  await page.goto("/learn/retail/fc-anatomy");
  await expect(page.getByTestId("dc-sat")).toHaveText("+34.1");
  await expect(page.getByTestId("dc-wiggle")).toHaveText("28.66");
  await setRange(page, "dc-window", 2);
  await expect(page.getByTestId("dc-sat")).toHaveText("+81.8");
  await expect(page.getByTestId("dc-wiggle")).toHaveText("2.56");
  await expect(page.getByTestId("dc-rem")).toHaveText("11.69");
  await expect(page.getByTestId("acf-r")).toHaveText("0.676");
  await setRange(page, "acf-lag", 7);
  await expect(page.getByTestId("acf-r")).toHaveText("0.852");
  await expect(page.getByTestId("acf-pairs")).toHaveText("105");
  await expect(page.getByTestId("acf-pc")).toHaveText("0.962");
  await page.getByRole("radio", { name: "Remainder" }).click();
  await expect(page.getByTestId("acf-r")).toHaveText("-0.118");
  await expect(page.getByTestId("acf-band")).toHaveText("0.190");
  await expect(page.getByTestId("nz-share")).toHaveText("3.2%");
  await expect(page.getByTestId("nz-any")).toHaveText("56.8%");
});

test("Forecasting baselines: rolling origin, the slow-mover trap and one-week holdouts", async ({ page }) => {
  await page.goto("/learn/retail/fc-baselines");
  await expect(page.getByTestId("ro-wape")).toHaveText("3.1%");
  await expect(page.getByTestId("ro-bias")).toHaveText("-1.9%");
  await expect(page.getByTestId("ro-mase")).toHaveText("0.93");
  await expect(page.getByTestId("ro-fold-wape")).toHaveText("2.3%");
  await page.getByRole("radio", { name: "Naive (yesterday)" }).click();
  await expect(page.getByTestId("ro-wape")).toHaveText("12.7%");
  await expect(page.getByTestId("ro-bias")).toHaveText("+10.4%");
  await expect(page.getByTestId("sm-wape")).toHaveText("109.8%");
  await setRange(page, "sm-f", 0);
  await expect(page.getByTestId("sm-wape")).toHaveText("100.0%");
  await expect(page.getByTestId("sm-bias")).toHaveText("-100.0%");
  await expect(page.getByTestId("ho-single-wrong")).toHaveText("10.3%");
  await expect(page.getByTestId("ho-rolling-wrong")).toHaveText("0.0%");
  await expect(page.getByTestId("ho-single-sd")).toHaveText("0.94");
});

test("Exponential smoothing: α trades noise for speed, and the best α matches theory", async ({ page }) => {
  await page.goto("/learn/retail/fc-ets");
  await expect(page.getByTestId("ses-rmse")).toHaveText("104.1");
  await expect(page.getByTestId("ses-half")).toHaveText("1.94");
  await expect(page.getByTestId("ses-best")).toHaveText("0.42");
  await setRange(page, "ses-alpha", 0.1);
  await expect(page.getByTestId("ses-rmse")).toHaveText("121.1");
  await expect(page.getByTestId("ses-90")).toHaveText("22");
  await setRange(page, "ses-alpha", 1);
  await expect(page.getByTestId("ses-rmse")).toHaveText("120.8");
  await expect(page.getByTestId("as-fit-1")).toHaveText("0.610");
});

test("ARIMA: AR, MA and random-walk signatures, and the forecast fan", async ({ page }) => {
  await page.goto("/learn/retail/fc-arima");
  await expect(page.getByTestId("ap-r1")).toHaveText("0.64");
  await expect(page.getByTestId("ap-t1")).toHaveText("0.60");
  await expect(page.getByTestId("ap-p2")).toHaveText("-0.01");
  await page.getByRole("radio", { name: "MA(1)" }).click();
  await expect(page.getByTestId("ap-r1")).toHaveText("0.49");
  await expect(page.getByTestId("ap-p2")).toHaveText("-0.21");
  await page.getByRole("radio", { name: "Random walk", exact: true }).click();
  await expect(page.getByTestId("ap-r1")).toHaveText("0.96");
  await page.getByRole("radio", { name: "Walk, differenced" }).click();
  await expect(page.getByTestId("ap-r1")).toHaveText("0.05");
  await expect(page.getByTestId("ff-sd-26")).toHaveText("124");
  await expect(page.getByTestId("ff-mid")).toHaveText("2,803");
  await page.getByRole("radio", { name: "Random walk (φ = 1)" }).click();
  await expect(page.getByTestId("ff-sd-26")).toHaveText("507");
  await expect(page.getByTestId("ff-mid")).toHaveText("3,003");
});

test("Censored demand: the likelihood sees past the empty shelf", async ({ page }) => {
  await page.goto("/learn/retail/fc-censored-demand");
  await expect(page.getByTestId("cs-out")).toHaveText("55%");
  await expect(page.getByTestId("cs-naive")).toHaveText("10.73");
  await expect(page.getByTestId("cs-dropped")).toHaveText("9.16");
  await expect(page.getByTestId("cs-mle")).toHaveText("12.19");
  await setRange(page, "cs-shelf", 16);
  await expect(page.getByTestId("cs-mle")).toHaveText("12.37");
  await expect(page.getByTestId("sp-naive-end")).toHaveText("9");
  await expect(page.getByTestId("sp-naive-lost")).toHaveText("19.4%");
  await expect(page.getByTestId("sp-mle-lost")).toHaveText("9.7%");
});

test("Intermittent demand: Croston never notices a dead item, TSB does", async ({ page }) => {
  await page.goto("/learn/retail/fc-intermittent");
  await expect(page.getByTestId("dr-78")).toHaveText("0.633");
  await expect(page.getByTestId("dr-end")).toHaveText("0.633");
  await expect(page.getByTestId("dr-dead")).toHaveText("16.5");
  await page.getByRole("radio", { name: "TSB" }).click();
  await expect(page.getByTestId("dr-end")).toHaveText("0.050");
  await expect(page.getByTestId("dr-dead")).toHaveText("7.2");
  await expect(page.getByTestId("is-mean-croston")).toHaveText("0.798");
  await expect(page.getByTestId("is-rmse-sba")).toHaveText("0.206");
});

test("Tweedie: the zero spike, and log-link stumps beat squared error", async ({ page }) => {
  await page.goto("/learn/retail/fc-tweedie-lgbm");
  await expect(page.getByTestId("tw-p0")).toHaveText("0.059");
  await expect(page.getByTestId("tw-mean")).toHaveText("2.01");
  await setRange(page, "tw-mu", 0);
  await setRange(page, "tw-p", 1.2);
  await expect(page.getByTestId("tw-p0")).toHaveText("0.621");
  await expect(page.getByTestId("gb-sq")).toHaveText("183.4%", { timeout: 20_000 });
  await expect(page.getByTestId("gb-neg")).toHaveText("285");
  await expect(page.getByTestId("gb-tw")).toHaveText("9.6%");
  await page.getByRole("radio", { name: "Depth 4" }).click();
  await expect(page.getByTestId("gb-tw")).toHaveText("22.9%", { timeout: 20_000 });
});

test("MinT: reconciliation by variance, and every level improves", async ({ page }) => {
  await page.goto("/learn/retail/fc-mint");
  await expect(page.getByTestId("rc-gap")).toHaveText("-5");
  await expect(page.getByTestId("rc-total")).toHaveText("102.5");
  await expect(page.getByTestId("rc-a")).toHaveText("58.4");
  await setRange(page, "rc-sd", 1);
  await expect(page.getByTestId("rc-total")).toHaveText("100.19");
  await page.getByRole("radio", { name: "OLS" }).click();
  await expect(page.getByTestId("rc-total")).toHaveText("101.67");
  await expect(page.getByTestId("mt-bu-total")).toHaveText("29.9");
  await expect(page.getByTestId("mt-wls-total")).toHaveText("15.8");
  await expect(page.getByTestId("mt-wls-stores")).toHaveText("12.5");
});

test("pinball: the minimum is the quantile, and conformal intervals keep coverage", async ({ page }) => {
  await page.goto("/learn/retail/fc-pinball");
  await expect(page.getByTestId("pb-q")).toHaveText("10");
  await expect(page.getByTestId("pb-below")).toHaveText("80%");
  await expect(page.getByTestId("pb-mean")).toHaveText("8.4");
  await page.getByRole("radio", { name: "200 days" }).click();
  await expect(page.getByTestId("pb-below")).toHaveText("76%");
  await setRange(page, "pb-tau", 0.9);
  await expect(page.getByTestId("pb-q")).toHaveText("15");
  await expect(page.getByTestId("cf-pois")).toHaveText("48.8%");
  await expect(page.getByTestId("cf-mean")).toHaveText("81.6%");
  await expect(page.getByTestId("cf-low")).toHaveText("25.4%");
  await setRange(page, "cf-n", 2);
  await expect(page.getByTestId("cf-low")).toHaveText("12.1%");
});

test("promotions: the dip, the profit, and lagged promo features", async ({ page }) => {
  await page.goto("/learn/retail/fc-promotions");
  await expect(page.getByTestId("pr-lift")).toHaveText("120");
  await expect(page.getByTestId("pr-net")).toHaveText("72");
  await expect(page.getByTestId("pr-profit")).toHaveText("−₹5,240");
  await setRange(page, "pr-pull", 0);
  await expect(page.getByTestId("pr-profit")).toHaveText("−₹1,400");
  await setRange(page, "pr-depth", 0.1);
  await expect(page.getByTestId("pr-profit")).toHaveText("+₹9");
  await expect(page.getByTestId("ps-promo-history")).toHaveText("45.3%");
  await expect(page.getByTestId("ps-post-depth")).toHaveText("+9.7%");
  await expect(page.getByTestId("ps-post-dip")).toHaveText("-0.5%");
  await page.getByRole("radio", { name: "History average" }).click();
  await expect(page.getByRole("radio", { name: "History average" })).toHaveAttribute("aria-checked", "true");
});

test("deep models: sample paths for lead-time totals, and global vs local", async ({ page }) => {
  await page.goto("/learn/retail/fc-deep");
  await expect(page.getByTestId("dp-paths")).toHaveText("199.8");
  await expect(page.getByTestId("dp-sum")).toHaveText("209.0");
  await expect(page.getByTestId("dp-indep")).toHaveText("190.2");
  await setRange(page, "dp-lead", 8);
  await expect(page.getByTestId("dp-sum")).toHaveText("410.1");
  await expect(page.getByTestId("dp-paths")).toHaveText("379.0");
  await expect(page.getByTestId("gl-global-8")).toHaveText("13.5%");
  await expect(page.getByTestId("gl-local-8")).toHaveText("21.9%");
  await page.getByRole("radio", { name: "Unlike it (φ = 0.95)" }).click();
  await expect(page.getByTestId("gl-local-52")).toHaveText("5.5%");
  await expect(page.getByTestId("gl-global-52")).toHaveText("7.9%");
});

test("safety stock: the critical ratio, correlated errors and per-SKU policies", async ({ page }) => {
  await page.goto("/learn/retail/fc-safety-stock");
  await expect(page.getByTestId("nv-cr")).toHaveText("0.643");
  await expect(page.getByTestId("nv-q")).toHaveText("107");
  await expect(page.getByTestId("nv-profit")).toHaveText("₹15,620");
  await setRange(page, "nv-cost", 250);
  await expect(page.getByTestId("nv-q")).toHaveText("79");
  await expect(page.getByTestId("nv-mean-profit")).toHaveText("₹2,511");
  await expect(page.getByTestId("lt-true")).toHaveText("28.7");
  await expect(page.getByTestId("lt-service")).toHaveText("87.4%");
  await setRange(page, "lt-lead", 8);
  await setRange(page, "lt-rho", 0.8);
  await expect(page.getByTestId("lt-service")).toHaveText("77.3%");
  await expect(page.getByTestId("pol-profit-p95")).toHaveText("−₹4,53,511");
  await expect(page.getByTestId("pol-profit-cr")).toHaveText("₹10,25,760");
  await setRange(page, "pol-salvage", 0);
  await expect(page.getByTestId("pol-profit-p95")).toHaveText("−₹11,94,306");
});

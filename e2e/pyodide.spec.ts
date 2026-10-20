import { expect, test } from "@playwright/test";

// Downloads Python from a CDN, so it only runs when explicitly requested.
test.skip(!process.env.PYODIDE_E2E, "set PYODIDE_E2E=1 to run (needs CDN access)");

const lessons: [string, string][] = [
  ["/learn/foundations/counting-worlds", "formula   P(fraud | flag): 0.1538"],
  ["/learn/foundations/ci-repeat", "80 stores"],
  ["/learn/foundations/likelihood-dial", "sample mean:                  1.0"],
  ["/learn/models/boosting-by-hand", "32.25"],
  ["/models/linear-regression", "lasso, alpha=6:  b = -5.00"],
  ["/models/decision-tree", "root: tier < 1.5, gain 5880.00"],
  ["/learn/bayes/mle-peak", "Bernoulli NLL at p=0.4: 3.365"],
  ["/models/gradient-boosting", "xgboost, lambda=3:    [24.5 24.5 24.5 31.5 31.5 31.5]"],
  ["/models/xgb-lgbm-catboost", "missing rows go left"],
  ["/models/mlp", "after one step: prediction 9.714, loss 0.0409"],
  ["/learn/models/tree-vs-mlp", "tree forecast weeks 8, 10: [28.5 28.5]"],
  ["/models/model-arena", "bias -25.0%"],
  ["/learn/foundations/integrals-thin-bars", "Beta(5,15), 500 bars: total 1.0000  P(rate <= 0.3) 0.7178  mean 0.2500"],
  ["/learn/foundations/vectors-baskets", "cos(A,B) = 0.866  cos(A,D) = 0.866  cos(A,C) = 0.000"],
  ["/learn/foundations/matrices-tables", "margins: [8600 9950 9800]"],
  ["/learn/bayes/posterior-grid", "grid posterior: mean 1.333, 90% interval 0.45 to 2.58"],
  ["/learn/bayes/beta-binomial", "posterior Beta(5, 15): mean 0.250, 90% interval 0.110 to 0.419"],
  ["/learn/bayes/gamma-poisson", "posterior Gamma(5, 4): mean 1.25, 90% interval 0.49 to 2.29"],
  ["/learn/bayes/shrinkage", "shrinking won in 996 of 1000 chains"],
  ["/learn/bayes/bayes-linreg", "grid posterior: mean -4.000, sd 0.447"],
  ["/learn/bayes/hierarchical-pooling", "partial pooling  mean squared error   22.1"],
  ["/learn/bayes/priors-defend", "lift: weight on new test 0.20, posterior 7.20% +/- 1.79"],
  ["/learn/bayes/why-sample", "4000 draws: spread of the estimate 0.0069   theory 0.0071"],
  ["/learn/bayes/mcmc-walker", "step  0.3: accept 35%, mean 0.248, R-hat 1.001"],
  ["/learn/bayes/bayes-ab", "look daily            fake winners 21.9%"],
  ["/learn/bayes/bayes-mmm-bridge", "lift    : TV ROI  1.28 (90%  0.80 to 1.73), P(TV pays back) 0.84"],
];

for (const [path, expected] of lessons) {
  test(`Build It runs cleanly on ${path}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(path);
    const runner = page.getByTestId("pyrunner").first();
    await runner.getByRole("button", { name: "Run ▶" }).click();
    const output = runner.getByTestId("pyrunner-output");
    await expect(output).toContainText(expected, { timeout: 230_000 });
    await expect(output).not.toContainText("Traceback");
  });
}

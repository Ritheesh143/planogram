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

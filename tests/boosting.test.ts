import { describe, expect, it } from "vitest";
import { BOOST_X, BOOST_Y } from "@/components/viz/BoostingByHand";
import { GOSS_G, HIST_PRICE, HIST_UNITS, TS_BEAT, TS_STORES } from "@/components/viz/BoostingInternals";
import { fitGBM, predictGBM } from "@/lib/sim/gbm";
import { mulberry32 } from "@/lib/sim/rng";
import { fitTree, leafImpurity, splitCandidates, treeDepth } from "@/lib/sim/tree";
import {
  bestXSplit,
  bundleExclusive,
  fitXGB,
  fitXTree,
  goss,
  leafWeight,
  naiveTargetEncoding,
  orderedTargetStats,
  predictXGB,
  predictXTree,
  quantileCuts,
  splitGain,
} from "@/lib/sim/xgb";

const X6 = BOOST_X.map((v) => [v]);

describe("gradient boosting with other losses (hand numbers)", () => {
  it("absolute loss: median start, sign residuals, median leaves", () => {
    const m = fitGBM(X6, BOOST_Y, { rounds: 1, lr: 0.5, maxDepth: 1, loss: "absolute" });
    expect(m.base).toBe(26);
    expect(m.trees[0].split!.threshold).toBe(47.5);
    expect([m.trees[0].left!.value, m.trees[0].right!.value]).toEqual([-12, 14]);
    expect(X6.map((r) => predictGBM(m, r))).toEqual([20, 20, 20, 33, 33, 33]);
  });

  it("Poisson loss: the same first split, but the step is multiplicative", () => {
    const m = fitGBM(X6, BOOST_Y, { rounds: 1, lr: 0.5, maxDepth: 1, loss: "poisson" });
    expect(m.base).toBeCloseTo(Math.log(28), 12);
    expect(m.trees[0].left!.value).toBeCloseTo(-0.5, 12);
    expect(m.trees[0].right!.value).toBeCloseTo(0.5, 12);
    expect(predictGBM(m, [20])).toBeCloseTo(28 * Math.exp(-0.25), 10);
    expect(predictGBM(m, [20])).toBeCloseTo(21.81, 2);
    expect(predictGBM(m, [90])).toBeCloseTo(35.95, 2);
  });

  it("quantile loss at 0.9 starts at the 90th percentile and isolates the top store", () => {
    const m = fitGBM(X6, BOOST_Y, { rounds: 1, lr: 0.5, maxDepth: 1, loss: "quantile", alpha: 0.9 });
    expect(m.base).toBe(46);
    expect(m.trees[0].split!.threshold).toBe(80);
  });
});

describe("XGBoost's second-order step", () => {
  it("reproduces Keystone 4: w* = −14, gain 588; λ = 3 halves both", () => {
    const g = BOOST_Y.map((y) => 28 - y);
    const h = g.map(() => 1);
    const t0 = fitXTree(X6, g, h, { maxDepth: 1, lambda: 0 });
    expect(t0.split!.gain).toBeCloseTo(588, 10);
    expect(t0.left!.weight).toBeCloseTo(-14, 10);
    const t3 = fitXTree(X6, g, h, { maxDepth: 1, lambda: 3 });
    expect(t3.split!.gain).toBeCloseTo(294, 10);
    expect(t3.left!.weight).toBeCloseTo(-7, 10);
    expect(leafWeight(-42, 3, 3)).toBe(7);
    const m = fitXGB(X6, BOOST_Y, { rounds: 1, lr: 0.5, maxDepth: 1, lambda: 3 });
    expect(predictXGB(m, [20])).toBeCloseTo(24.5, 10);
    expect(predictXGB(m, [90])).toBeCloseTo(31.5, 10);
  });

  it("γ refuses a split whose gain doesn't cover it", () => {
    const g = BOOST_Y.map((y) => 28 - y);
    const h = g.map(() => 1);
    expect(fitXTree(X6, g, h, { maxDepth: 1, lambda: 0, gamma: 500 }).split).toBeDefined();
    expect(fitXTree(X6, g, h, { maxDepth: 1, lambda: 0, gamma: 600 }).split).toBeUndefined();
    expect(splitGain(-42, 3, 42, 3, 0, 600)).toBeCloseTo(-12, 10);
  });

  it("matches the squared-loss GBM exactly when λ = 0", () => {
    const a = fitXGB(X6, BOOST_Y, { rounds: 5, lr: 0.3, maxDepth: 2, lambda: 0 });
    const b = fitGBM(X6, BOOST_Y, { rounds: 5, lr: 0.3, maxDepth: 2 });
    for (const r of X6) expect(predictXGB(a, r)).toBeCloseTo(predictGBM(b, r), 10);
  });

  it("sends missing values to the side that gains more", () => {
    const X = [[2], [5], [9], [14], [NaN], [NaN]];
    const r = [4, 3, -2, -3, 5, 4];
    const g = r.map((v) => -v);
    const h = r.map(() => 1);
    const s = bestXSplit(X, g, h, [0, 1, 2, 3, 4, 5], { lambda: 0, gamma: 0, minChildWeight: 0 })!;
    expect(s.threshold).toBe(7);
    expect(s.missingLeft).toBe(true);
    expect(s.gain).toBeCloseTo(28.167, 3);
    expect(splitGain(-7, 2, -4, 4, 0, 0)).toBeCloseTo(4.167, 3);
    const t = fitXTree(X, g, h, { maxDepth: 1, lambda: 0 });
    expect(predictXTree(t, [NaN])).toBe(predictXTree(t, [3]));
  });
});

describe("LightGBM and CatBoost tricks", () => {
  it("histogram bins lose a little gain on the eight weeks", () => {
    expect(quantileCuts(HIST_PRICE, 4)).toEqual([142.5, 215, 390]);
    const cands = splitCandidates(HIST_PRICE.map((p) => [p]), HIST_UNITS, HIST_PRICE.map((_, i) => i));
    const best = cands.reduce((a, b) => (b.gain > a.gain ? b : a));
    expect(best.threshold).toBe(300);
    expect(best.gain).toBeCloseTo(448.53, 2);
    expect(cands.find((c) => c.threshold === 215)!.gain).toBeCloseTo(420.5, 2);
  });

  it("GOSS estimates of the gradient sum are unbiased", () => {
    const trueG = GOSS_G.reduce((a, b) => a + b, 0);
    expect(trueG).toBeCloseTo(-1.9, 10);
    const rng = mulberry32(4);
    let s = 0;
    const N = 40_000;
    for (let k = 0; k < N; k++) {
      const d = goss(GOSS_G, 0.2, 0.2, rng);
      s += d.rows.reduce((t, r, i) => t + GOSS_G[r] * d.weights[i], 0);
    }
    expect(s / N).toBeCloseTo(-1.9, 1);
    const one = goss(GOSS_G, 0.2, 0.2, mulberry32(1));
    expect(one.rows.slice(0, 2).sort()).toEqual([0, 1]);
    expect(one.weights).toEqual([1, 1, 4, 4]);
  });

  it("bundles exclusive promo flags into one column", () => {
    expect(bundleExclusive([1, 0, 0, 1, 0], [0, 1, 0, 0, 1])).toEqual([1, 2, 0, 1, 2]);
    expect(() => bundleExclusive([1], [1])).toThrow();
  });

  it("ordered target statistics match the hand table and don't leak", () => {
    expect(naiveTargetEncoding(TS_STORES, TS_BEAT).map((v) => +v.toFixed(3))).toEqual([0.667, 0, 0.667, 1, 0, 0.667]);
    expect(orderedTargetStats(TS_STORES, TS_BEAT, 0.5, 1).map((v) => +v.toFixed(3))).toEqual([0.5, 0.5, 0.75, 0.5, 0.25, 0.833]);
    const rng = mulberry32(17);
    const cats = Array.from({ length: 800 }, () => `s${Math.floor(rng() * 400)}`);
    const y = cats.map(() => (rng() < 0.5 ? 1 : 0));
    const acc = (enc: number[]) => enc.filter((v, i) => (v > 0.5 ? 1 : 0) === y[i]).length / y.length;
    expect(acc(naiveTargetEncoding(cats, y))).toBeGreaterThan(0.7);
    expect(Math.abs(acc(orderedTargetStats(cats, y, 0.5, 1)) - 0.5)).toBeLessThan(0.06);
  });

  it("leaf-wise growth reaches lower training error and deeper trees for the same leaves", () => {
    const rng = mulberry32(9);
    const X = Array.from({ length: 120 }, () => [10 + rng() * 30, rng() * 20]);
    const y = X.map(([a, d]) => 30 + 2 * a - 1.5 * d + (rng() - 0.5) * 20);
    for (const n of [6, 10, 16]) {
      const level = fitTree(X, y, { growth: "depth", maxLeaves: n, maxDepth: 30 });
      const leaf = fitTree(X, y, { growth: "leaf", maxLeaves: n, maxDepth: 30 });
      expect(leafImpurity(leaf)).toBeLessThanOrEqual(leafImpurity(level) + 1e-9);
      expect(treeDepth(leaf)).toBeGreaterThanOrEqual(treeDepth(level));
    }
  });
});

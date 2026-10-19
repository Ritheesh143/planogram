import { describe, expect, it } from "vitest";
import { BOOST_X, BOOST_Y } from "@/components/viz/BoostingByHand";
import { boost } from "@/lib/sim/boosting";
import { evaluate, MODEL_IDS } from "@/lib/sim/failureLab";
import { fitGBM, predictGBM } from "@/lib/sim/gbm";
import { solve, xtx, xty } from "@/lib/sim/linalg";
import { fitLasso, fitLine, fitLinear, fitPoisson, gradientPath, predictPoisson, sseLine, withIntercept } from "@/lib/sim/linreg";
import { backward, initLayers, predictMLP, trainMLP } from "@/lib/sim/mlp";
import { mulberry32, normal, poisson } from "@/lib/sim/rng";
import { getScenario, small } from "@/lib/sim/scenarios";
import { entropy, fitTree, gini, leafImpurity, leaves, predictTree, prune, regions, splitCandidates } from "@/lib/sim/tree";
import { LR_PRICE, LR_UNITS } from "@/components/viz/LinRegPlayground";
import { DT_X, DT_Y, STOCKOUT_COVER, STOCKOUT_LABEL } from "@/components/viz/TreePlayground";

describe("linear regression by hand", () => {
  it("recovers slope −8 and intercept 100 from the five paint weeks", () => {
    const f = fitLine(LR_PRICE, LR_UNITS);
    expect(f.slope).toBeCloseTo(-8, 10);
    expect(f.intercept).toBeCloseTo(100, 10);
    expect(f.sse).toBeCloseTo(14, 10);
    expect(sseLine(LR_PRICE, LR_UNITS, 90, -6)).toBe(74);
  });

  it("residuals sum to zero and are orthogonal to price", () => {
    const res = LR_PRICE.map((x, i) => LR_UNITS[i] - (100 - 8 * x));
    expect(res).toEqual([1, -2, 2, -2, 1]);
    expect(res.reduce((a, b) => a + b, 0)).toBe(0);
    expect(res.reduce((a, r, i) => a + r * LR_PRICE[i], 0)).toBe(0);
  });

  it("the normal equations give the same answer", () => {
    const X = withIntercept(LR_PRICE.map((p) => [p]));
    expect(xtx(X)).toEqual([[5, 30], [30, 190]]);
    expect(xty(X, LR_UNITS)).toEqual([260, 1480]);
    const [a, b] = solve(xtx(X), xty(X, LR_UNITS));
    expect(a).toBeCloseTo(100, 10);
    expect(b).toBeCloseTo(-8, 10);
  });

  it("ridge halves the slope at λ = 10; lasso soft-thresholds it", () => {
    const X = LR_PRICE.map((p) => [p]);
    expect(fitLinear(X, LR_UNITS, 10).coef[0]).toBeCloseTo(-4, 10);
    expect(fitLasso(X, LR_UNITS, 30).coef[0]).toBeCloseTo(-5, 8);
    expect(fitLasso(X, LR_UNITS, 80).coef[0]).toBe(0);
  });

  it("gradient descent converges much faster on centered prices", () => {
    const raw = gradientPath(LR_PRICE, LR_UNITS, 0.005, 300);
    const centered = gradientPath(LR_PRICE.map((p) => p - 6), LR_UNITS, 0.05, 300);
    expect(centered.at(-1)!.sse).toBeCloseTo(14, 4);
    expect(raw.at(-1)!.sse).toBeGreaterThan(20);
  });

  it("a Poisson GLM recovers a planted log-rate and never predicts below zero", () => {
    const rng = mulberry32(5);
    const x = Array.from({ length: 2000 }, () => rng() * 2);
    const y = x.map((v) => poisson(rng, Math.exp(1 - 0.8 * v)));
    const fit = fitPoisson(x.map((v) => [v]), y);
    expect(fit.intercept).toBeCloseTo(1, 1);
    expect(fit.coef[0]).toBeCloseTo(-0.8, 1);
    expect(predictPoisson(fit, [50])).toBeGreaterThan(0);
  });

  it("collinear prices make individual coefficients unstable but their sum stable", () => {
    const sums: number[] = [];
    const firsts: number[] = [];
    for (let seed = 0; seed < 40; seed++) {
      const rng = mulberry32(seed);
      const X = Array.from({ length: 30 }, () => {
        const p = 4 + rng() * 4;
        return [p, p + normal(rng, 0, 0.05)];
      });
      const y = X.map(([a]) => 100 - 8 * a + normal(rng, 0, 2));
      const f = fitLinear(X, y);
      sums.push(f.coef[0] + f.coef[1]);
      firsts.push(f.coef[0]);
    }
    const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
    expect(spread(firsts)).toBeGreaterThan(10 * spread(sums));
  });
});

describe("decision tree by hand", () => {
  it("scores the tier split at 5,880 and picks it at the root", () => {
    const cands = splitCandidates(DT_X, DT_Y, DT_X.map((_, i) => i));
    const tier = cands.find((c) => c.feature === 0 && c.threshold === 1.5)!;
    expect([tier.leftImpurity, tier.rightImpurity, tier.gain]).toEqual([200, 1120, 5880]);
    const area = cands.find((c) => c.feature === 1 && c.threshold === 13.5)!;
    expect(area.gain).toBeCloseTo(3266.67, 2);
    const t = fitTree(DT_X, DT_Y, { maxDepth: 2 });
    expect(t.impurity).toBe(7200);
    expect(t.split).toMatchObject({ feature: 0, threshold: 1.5 });
    expect(leaves(t).map((l) => l.value)).toEqual([100, 115, 47.5, 80]);
    expect(leafImpurity(t)).toBe(325);
    // A huge new tier-1 store gets the same prediction as a 25k one: no extrapolation.
    expect(predictTree(t, [1, 60])).toBe(115);
  });

  it("matches the hand Gini and entropy numbers for the stockout split", () => {
    expect(gini(3 / 8)).toBeCloseTo(0.469, 3);
    expect(entropy(3 / 8)).toBeCloseTo(0.954, 3);
    expect(gini(0.75)).toBeCloseTo(0.375, 3);
    expect(entropy(1 / 6)).toBeCloseTo(0.65, 3);
    const X = STOCKOUT_COVER.map((c) => [c]);
    const rows = X.map((_, i) => i);
    for (const crit of ["gini", "entropy"] as const) {
      const t = fitTree(X, STOCKOUT_LABEL, { criterion: crit, maxDepth: 1 });
      expect(t.split!.threshold).toBe(6);
      const c = splitCandidates(X, STOCKOUT_LABEL, rows, crit);
      const at6 = c.find((s) => s.threshold === 6)!;
      const at35 = c.find((s) => s.threshold === 3.5)!;
      expect(at6.gain).toBeGreaterThan(at35.gain);
    }
    // Weighted Gini after the 6-day split: (4/8)·0.375 + (4/8)·0 = 0.1875.
    const g = splitCandidates(X, STOCKOUT_LABEL, rows, "gini").find((s) => s.threshold === 6)!;
    expect((g.leftImpurity + g.rightImpurity) / 8).toBeCloseTo(0.1875, 10);
  });

  it("pruning trades leaves for error exactly at α", () => {
    const t = fitTree(DT_X, DT_Y, { maxDepth: 2 });
    // The left subtree's split gains 150 and the right's 845.
    expect(leaves(prune(t, 100)).length).toBe(4);
    expect(leaves(prune(t, 200)).length).toBe(3);
    expect(leaves(prune(t, 900)).length).toBe(2);
    expect(leaves(prune(t, 6000)).length).toBe(1);
  });

  it("leaf-wise growth with 3 leaves splits the better child first", () => {
    const t = fitTree(DT_X, DT_Y, { growth: "leaf", maxLeaves: 3, maxDepth: 10 });
    expect(leaves(t).map((l) => l.value)).toEqual([110, 47.5, 80]);
  });

  it("regions tile the feature space", () => {
    const t = fitTree(DT_X, DT_Y, { maxDepth: 2 });
    const r = regions(t, [0.5, 5], [3.5, 35]);
    const area = r.reduce((s, b) => s + (b.hi[0] - b.lo[0]) * (b.hi[1] - b.lo[1]), 0);
    expect(area).toBeCloseTo(3 * 30, 10);
  });
});

describe("gradient boosting", () => {
  it("reduces to Keystone 4 with squared loss and stumps", () => {
    for (const lr of [1, 0.5]) {
      const ks = boost(BOOST_X, BOOST_Y, 3, lr);
      const g = fitGBM(BOOST_X.map((x) => [x]), BOOST_Y, { rounds: 3, lr, maxDepth: 1 });
      BOOST_X.forEach((x, i) => expect(predictGBM(g, [x])).toBeCloseTo(ks[3].pred[i], 10));
    }
  });

  it("absolute loss ignores an outlier that squared loss chases", () => {
    const x = [1, 2, 3, 4, 5, 6].map((v) => [v]);
    const y = [10, 10, 10, 10, 10, 200];
    const sq = fitGBM(x, y, { rounds: 50, lr: 0.3, maxDepth: 1, loss: "squared" });
    const abs = fitGBM(x, y, { rounds: 50, lr: 0.3, maxDepth: 1, loss: "absolute" });
    expect(predictGBM(sq, [5])).toBeCloseTo(10, 0);
    expect(predictGBM(abs, [3])).toBeCloseTo(10, 6);
  });

  it("Poisson loss keeps predictions positive", () => {
    const x = [1, 2, 3, 4, 5, 6].map((v) => [v]);
    const g = fitGBM(x, [0, 0, 1, 0, 3, 5], { rounds: 30, lr: 0.3, maxDepth: 1, loss: "poisson" });
    for (let v = 0; v <= 8; v++) expect(predictGBM(g, [v])).toBeGreaterThan(0);
  });
});

describe("MLP", () => {
  it("backprop matches finite differences", () => {
    const layers = initLayers([2, 3, 1], 4);
    const x = [0.5, -1.2];
    const y = 0.7;
    const { grads } = backward(layers, x, y);
    const lossAt = () => {
      const { pred } = backward(layers, x, y);
      return 0.5 * (pred - y) ** 2;
    };
    const eps = 1e-6;
    for (const [l, j, k] of [[0, 1, 0], [0, 2, 1], [1, 0, 2]]) {
      const w = layers[l].W[j][k];
      layers[l].W[j][k] = w + eps;
      const up = lossAt();
      layers[l].W[j][k] = w - eps;
      const down = lossAt();
      layers[l].W[j][k] = w;
      expect(grads.dW[l][j][k]).toBeCloseTo((up - down) / (2 * eps), 6);
    }
  });

  it("learns a kinked demand curve", () => {
    const X = Array.from({ length: 30 }, (_, i) => [i]);
    const y = X.map(([v]) => (v < 15 ? 100 - 2 * v : 70 - 0.5 * (v - 15)));
    const { model, loss } = trainMLP(X, y, { hidden: [8], epochs: 2000, lr: 0.02, seed: 3 });
    expect(loss.at(-1)!).toBeLessThan(loss[0] / 50);
    expect(predictMLP(model, [5])).toBeCloseTo(90, -1);
  });
});

describe("Failure Lab claims", () => {
  const rmse = (id: string) => Object.fromEntries(MODEL_IDS.map((m) => [m, evaluate(getScenario(id), m)]));

  it("trend: only the line and the MLP follow the trend; trees go flat", () => {
    const r = rmse("trend");
    expect(r.linear.testRmse).toBeLessThan(r.tree.testRmse / 2);
    expect(r.linear.testRmse).toBeLessThan(r.gbm.testRmse / 2);
    expect(r.tree.predict([52])).toBe(r.tree.predict([45]));
  });

  it("step: one tree split beats a line", () => {
    const r = rmse("step");
    expect(r.tree.testRmse).toBeLessThan(r.linear.testRmse / 2);
  });

  it("interaction: the linear model without an interaction term does worst", () => {
    const r = rmse("interaction");
    for (const m of ["tree", "gbm", "mlp"]) expect(r.linear.testRmse).toBeGreaterThan(r[m].testRmse);
    const s = (id: string, g: number) => (r[id].predict([500, g]) - r[id].predict([400, g])) / 100;
    expect(s("linear", 0)).toBeCloseTo(s("linear", 1), 10);
  });

  it("small data: the line beats the tree and boosting in every one of 40 reseeds", () => {
    for (let seed = 600; seed < 640; seed++) {
      const s = small(seed);
      const lin = evaluate(s, "linear").testRmse;
      expect(lin).toBeLessThan(evaluate(s, "tree").testRmse);
      expect(lin).toBeLessThan(evaluate(s, "gbm").testRmse);
    }
  });

  it("zeros: the line predicts negative sales; trees never do", () => {
    const r = rmse("zeros");
    expect(r.linear.checkValue).toBeGreaterThan(0.2);
    expect(r.tree.checkValue).toBe(0);
    expect(r.gbm.checkValue).toBe(0);
  });

  it("monotone: only the line never predicts a rise in demand with price", () => {
    const r = rmse("monotone");
    expect(r.linear.checkValue).toBe(0);
    expect(r.tree.checkValue).toBeGreaterThan(0);
    expect(r.gbm.checkValue).toBeGreaterThan(0);
    expect(r.mlp.checkValue).toBeGreaterThan(0);
  });

  it("outlier: the line tilts toward the bulk order", () => {
    const s = getScenario("outlier");
    const slope = fitLine(s.train.X.map((r) => r[0]), s.train.y).slope;
    expect(slope).toBeGreaterThan(-0.3); // the planted slope is −0.4
  });
});

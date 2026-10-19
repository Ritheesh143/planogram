import { describe, expect, it } from "vitest";
import { BP_START, BP_X, BP_Y, DEMAND, demandCurve } from "@/components/viz/MLPLab";
import { surfaceData } from "@/components/viz/TreeVsMLP";
import { backward, predictMLP, trainMLP, type Layer } from "@/lib/sim/mlp";
import { mulberry32, normal } from "@/lib/sim/rng";
import { fitTree, predictTree } from "@/lib/sim/tree";

const clone = (ls: Layer[]): Layer[] => ls.map((l) => ({ W: l.W.map((r) => [...r]), b: [...l.b] }));

describe("MLP by hand", () => {
  it("forward and backward match the worked example", () => {
    const { grads, pred } = backward(BP_START, [BP_X], BP_Y);
    expect(pred).toBe(9);
    expect(grads.dW[1][0]).toEqual([-2, -1]);
    expect(grads.db[1]).toEqual([-1]);
    expect(grads.dW[0].map((r) => r[0])).toEqual([-6, -4]);
    expect(grads.db[0]).toEqual([-3, -2]);
  });

  it("a 0.01 step lowers the loss to 0.041; a 0.05 step overshoots to 12.65", () => {
    const step = (lr: number) => {
      const ls = clone(BP_START);
      const { grads } = backward(ls, [BP_X], BP_Y);
      ls.forEach((l, li) => {
        l.W.forEach((r, j) => r.forEach((w, k) => (r[k] = w - lr * grads.dW[li][j][k])));
        l.b.forEach((b, j) => (l.b[j] = b - lr * grads.db[li][j]));
      });
      return backward(ls, [BP_X], BP_Y).pred;
    };
    expect(step(0.01)).toBeCloseTo(9.714, 3);
    expect(0.5 * (step(0.01) - 10) ** 2).toBeCloseTo(0.041, 3);
    expect(step(0.05)).toBeCloseTo(12.65, 2);
    expect(0.5 * (step(0.05) - 10) ** 2).toBeCloseTo(3.51, 2);
  });

  it("two ReLU units draw the kinked demand curve", () => {
    const f = (x: number) => 60 - 12 * Math.max(0, x) + 9 * Math.max(0, x - 4);
    expect([f(2), f(4), f(6)]).toEqual([36, 12, 6]);
    expect([2, 4, 6].map(demandCurve)).toEqual([36, 12, 6]);
    const sse = DEMAND.xs.reduce((s, x, i) => s + (DEMAND.ys[i] - demandCurve(x)) ** 2, 0);
    expect(sse).toBeCloseTo(106.4, 1);
    const { model } = trainMLP(DEMAND.xs.map((v) => [v]), DEMAND.ys, { hidden: [3], epochs: 3000, lr: 0.02, seed: 2 });
    const fit = DEMAND.xs.reduce((s, x, i) => s + (DEMAND.ys[i] - predictMLP(model, [x])) ** 2, 0);
    expect(fit).toBeCloseTo(103.9, 1);
  });
});

describe("MLP trainer claims (prices in rupees)", () => {
  const rng = mulberry32(42);
  const txs = Array.from({ length: 200 }, () => 1 + rng() * 6);
  const tys = txs.map((x) => Math.round((demandCurve(x) + normal(rng, 0, 2)) * 10) / 10);
  const testRmse = (o: Parameters<typeof trainMLP>[2]) => {
    const { model } = trainMLP(DEMAND.xs.map((v) => [v * 1000]), DEMAND.ys, { epochs: 1500, lr: 0.01, seed: 7, ...o });
    return Math.sqrt(txs.reduce((s, x, i) => s + (predictMLP(model, [x * 1000]) - tys[i]) ** 2, 0) / txs.length);
  };
  it("matches the knobs table", () => {
    expect(testRmse({ hidden: [16] })).toBeCloseTo(2.15, 2);
    expect(testRmse({ hidden: [1] })).toBeCloseTo(4.58, 2);
    expect(testRmse({ hidden: [2] })).toBeCloseTo(2.13, 2);
    expect(testRmse({ hidden: [16, 16] })).toBeCloseTo(2.41, 2);
    expect(testRmse({ hidden: [16], weightDecay: 0.1 })).toBeCloseTo(3.59, 2);
    expect(testRmse({ hidden: [16], scale: false })).toBeCloseTo(19.67, 2);
    expect(testRmse({ hidden: [16], scale: false, optimizer: "sgd" })).toBeGreaterThan(1e4);
  }, 30_000);
});

describe("Tree vs MLP", () => {
  it("the tree on six weeks of trend goes flat; its splits are at 3.5, 2.5 and 4.5", () => {
    const X = [1, 2, 3, 4, 5, 6].map((w) => [w]);
    const t = fitTree(X, [10, 14, 19, 22, 27, 30], { maxDepth: 2 });
    expect(t.split!.threshold).toBe(3.5);
    expect([t.left!.split!.threshold, t.right!.split!.threshold]).toEqual([2.5, 4.5]);
    expect([1, 3, 4, 6, 7, 8, 10].map((w) => predictTree(t, [w]))).toEqual([12, 19, 22, 28.5, 28.5, 28.5, 28.5]);
  });

  it("the MLP wins the diagonal surface and the tree wins the thresholds", () => {
    const score = (kind: "oblique" | "steps", depth: number, hidden: number) => {
      const tr = surfaceData(kind, 100, 1);
      const te = surfaceData(kind, 500, 2);
      const t = fitTree(tr.X, tr.y, { maxDepth: depth });
      const { model } = trainMLP(tr.X, tr.y, { hidden: [hidden], epochs: 800, lr: 0.02, seed: 3 });
      const r = (p: (x: number[]) => number) => Math.sqrt(te.X.reduce((s, x, i) => s + (p(x) - te.y[i]) ** 2, 0) / te.X.length);
      return { tree: r((x) => predictTree(t, x)), mlp: r((x) => predictMLP(model, x)) };
    };
    const ob = score("oblique", 4, 4);
    expect(ob.tree).toBeCloseTo(9.7, 1);
    expect(ob.mlp).toBeCloseTo(4.9, 1);
    expect(score("oblique", 6, 4).tree).toBeCloseTo(9.1, 1);
    const st = score("steps", 3, 4);
    expect(st.tree).toBeCloseTo(5.8, 1);
    expect(st.mlp).toBeGreaterThan(st.tree + 1.5);
  }, 30_000);
});

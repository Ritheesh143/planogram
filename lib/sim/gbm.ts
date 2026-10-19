// Gradient boosting with depth-k trees and several losses. Each tree is fitted to the
// pseudo-residuals (the negative gradient of the loss), then its leaf values are re-estimated
// so each leaf takes the best step for that loss. Keystone 4 (lib/sim/boosting.ts) is the
// special case: squared loss, one feature, stumps.

import type { Matrix } from "./linalg";
import { fitTree, leaves, predictTree, type TreeNode } from "./tree";

export type Loss = "squared" | "absolute" | "quantile" | "poisson";

export type GBMOptions = {
  rounds?: number;
  lr?: number;
  maxDepth?: number;
  minLeaf?: number;
  loss?: Loss;
  /** Target quantile for the quantile (pinball) loss. */
  alpha?: number;
};

export type GBM = { base: number; trees: TreeNode[]; lr: number; loss: Loss };

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Negative gradient of the loss with respect to the raw score F, for each row. */
export function pseudoResiduals(loss: Loss, y: number[], F: number[], alpha = 0.5): number[] {
  switch (loss) {
    case "squared":
      return y.map((yi, i) => yi - F[i]);
    case "absolute":
      return y.map((yi, i) => Math.sign(yi - F[i]));
    case "quantile":
      return y.map((yi, i) => (yi > F[i] ? alpha : alpha - 1));
    case "poisson":
      // F is log(rate); d/dF of [exp(F) − y·F] is exp(F) − y.
      return y.map((yi, i) => yi - Math.exp(F[i]));
  }
}

function initialScore(loss: Loss, y: number[], alpha: number): number {
  if (loss === "absolute") return quantile(y, 0.5);
  if (loss === "quantile") return quantile(y, alpha);
  if (loss === "poisson") return Math.log(Math.max(mean(y), 1e-9));
  return mean(y);
}

/** The best constant step inside one leaf, for each loss. */
function leafStep(loss: Loss, y: number[], F: number[], rows: number[], alpha: number): number {
  const r = rows.map((i) => y[i] - F[i]);
  if (loss === "squared") return mean(r);
  if (loss === "absolute") return quantile(r, 0.5);
  if (loss === "quantile") return quantile(r, alpha);
  // Poisson: one Newton step, Σ(y − μ) / Σμ.
  const num = rows.reduce((s, i) => s + y[i] - Math.exp(F[i]), 0);
  const den = rows.reduce((s, i) => s + Math.exp(F[i]), 0);
  return num / Math.max(den, 1e-9);
}

export function fitGBM(X: Matrix, y: number[], opts: GBMOptions = {}): GBM {
  const { rounds = 100, lr = 0.1, maxDepth = 2, minLeaf = 1, loss = "squared", alpha = 0.5 } = opts;
  const base = initialScore(loss, y, alpha);
  const F = y.map(() => base);
  const trees: TreeNode[] = [];
  for (let m = 0; m < rounds; m++) {
    const g = pseudoResiduals(loss, y, F, alpha);
    const tree = fitTree(X, g, { maxDepth, minLeaf });
    for (const leaf of leaves(tree)) leaf.value = leafStep(loss, y, F, leaf.rows, alpha);
    trees.push(tree);
    X.forEach((row, i) => (F[i] += lr * predictTree(tree, row)));
  }
  return { base, trees, lr, loss };
}

/** Raw score after the first `upTo` trees (all of them by default). */
export function rawScore(model: GBM, row: number[], upTo = model.trees.length): number {
  let F = model.base;
  for (let m = 0; m < upTo; m++) F += model.lr * predictTree(model.trees[m], row);
  return F;
}

export function predictGBM(model: GBM, row: number[], upTo?: number): number {
  const F = rawScore(model, row, upTo);
  return model.loss === "poisson" ? Math.exp(F) : F;
}

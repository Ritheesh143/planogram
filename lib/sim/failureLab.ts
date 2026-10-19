// Fit every Model Lab model to a Failure Lab scenario and score it on the held-out rows.

import { fitGBM, predictGBM } from "./gbm";
import { fitLinear, predictLinear } from "./linreg";
import { predictMLP, trainMLP } from "./mlp";
import type { ModelId, Scenario } from "./scenarios";
import { fitTree, predictTree } from "./tree";

export const MODEL_IDS: ModelId[] = ["linear", "tree", "gbm", "mlp"];

export const MODEL_NAMES: Record<ModelId, string> = {
  linear: "Linear regression",
  tree: "Decision tree (depth 3)",
  gbm: "Gradient boosting (200 trees, depth 2)",
  mlp: "MLP (16 ReLU units)",
};

export type Predictor = (row: number[]) => number;

export function fitModel(id: ModelId, X: number[][], y: number[]): Predictor {
  switch (id) {
    case "linear": {
      const m = fitLinear(X, y);
      return (r) => predictLinear(m, r);
    }
    case "tree": {
      const t = fitTree(X, y, { maxDepth: 3, minLeaf: 1 });
      return (r) => predictTree(t, r);
    }
    case "gbm": {
      const g = fitGBM(X, y, { rounds: 200, lr: 0.1, maxDepth: 2 });
      return (r) => predictGBM(g, r);
    }
    case "mlp": {
      const { model } = trainMLP(X, y, { hidden: [16], epochs: 1500, lr: 0.01, seed: 7 });
      return (r) => predictMLP(model, r);
    }
  }
}

export type ModelResult = {
  id: ModelId;
  predict: Predictor;
  trainRmse: number;
  testRmse: number;
  /** For "negatives": share of the plot grid predicted below zero. For "rises": share of price steps where demand goes up. */
  checkValue?: number;
};

export function rmse(predict: Predictor, X: number[][], y: number[]): number {
  return Math.sqrt(X.reduce((s, row, i) => s + (predict(row) - y[i]) ** 2, 0) / X.length);
}

export function gridFor(s: Scenario, n = 120): number[] {
  const [lo, hi] = s.domain;
  return Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
}

export function evaluate(s: Scenario, id: ModelId): ModelResult {
  const predict = fitModel(id, s.train.X, s.train.y);
  const res: ModelResult = {
    id,
    predict,
    trainRmse: rmse(predict, s.train.X, s.train.y),
    testRmse: rmse(predict, s.test.X, s.test.y),
  };
  const grid = gridFor(s).map((x) => predict([x]));
  if (s.check === "negatives") res.checkValue = grid.filter((v) => v < 0).length / grid.length;
  if (s.check === "rises") {
    let up = 0;
    for (let i = 1; i < grid.length; i++) if (grid[i] > grid[i - 1] + 1e-9) up++;
    res.checkValue = up / (grid.length - 1);
  }
  return res;
}

// The tricks inside XGBoost, LightGBM and CatBoost, small enough to read:
// second-order leaves and gains, λ / γ / min_child_weight, level-wise vs leaf-wise growth,
// missing-value default directions, histogram bins, GOSS sampling, exclusive feature bundling,
// and CatBoost's ordered target statistics.

import type { Matrix } from "./linalg";
import type { Rng } from "./rng";

export type XGBParams = {
  lambda?: number;
  gamma?: number;
  minChildWeight?: number;
  maxDepth?: number;
  growth?: "depth" | "leaf";
  maxLeaves?: number;
  /** Candidate thresholds per feature (histogram mode). Exact mode tries every midpoint. */
  thresholds?: number[][];
};

/** The best value for a leaf with gradient sum G and hessian sum H: w* = −G / (H + λ). */
export function leafWeight(G: number, H: number, lambda: number): number {
  return -G / (H + lambda);
}

/** How much a split lowers the second-order objective, minus the γ charged for a new leaf. */
export function splitGain(GL: number, HL: number, GR: number, HR: number, lambda: number, gamma: number): number {
  const score = (G: number, H: number) => (G * G) / (H + lambda);
  return 0.5 * (score(GL, HL) + score(GR, HR) - score(GL + GR, HL + HR)) - gamma;
}

export type XNode = {
  id: number;
  depth: number;
  rows: number[];
  G: number;
  H: number;
  weight: number;
  split?: { feature: number; threshold: number; gain: number; missingLeft: boolean };
  left?: XNode;
  right?: XNode;
};

type Cand = { feature: number; threshold: number; gain: number; missingLeft: boolean; left: number[]; right: number[] };

function candidatesFor(X: Matrix, rows: number[], f: number, thresholds?: number[]): number[] {
  if (thresholds) return thresholds;
  const vals = [...new Set(rows.map((r) => X[r][f]).filter((v) => !Number.isNaN(v)))].sort((a, b) => a - b);
  return vals.slice(0, -1).map((v, i) => (v + vals[i + 1]) / 2);
}

/** Best split of these rows. Rows with a missing value (NaN) try both sides; the better side becomes the default. */
export function bestXSplit(X: Matrix, g: number[], h: number[], rows: number[], p: Required<Omit<XGBParams, "thresholds" | "growth" | "maxLeaves" | "maxDepth">> & { thresholds?: number[][] }): Cand | null {
  let best: Cand | null = null;
  const sum = (idx: number[], v: number[]) => idx.reduce((s, i) => s + v[i], 0);
  for (let f = 0; f < X[0].length; f++) {
    const missing = rows.filter((r) => Number.isNaN(X[r][f]));
    const present = rows.filter((r) => !Number.isNaN(X[r][f]));
    const Gm = sum(missing, g);
    const Hm = sum(missing, h);
    for (const t of candidatesFor(X, present, f, p.thresholds?.[f])) {
      const L = present.filter((r) => X[r][f] < t);
      const R = present.filter((r) => X[r][f] >= t);
      const GL = sum(L, g);
      const HL = sum(L, h);
      const GR = sum(R, g);
      const HR = sum(R, h);
      for (const missingLeft of missing.length ? [true, false] : [true]) {
        const gl = missingLeft ? GL + Gm : GL;
        const hl = missingLeft ? HL + Hm : HL;
        const gr = missingLeft ? GR : GR + Gm;
        const hr = missingLeft ? HR : HR + Hm;
        if (hl < p.minChildWeight || hr < p.minChildWeight) continue;
        const gain = splitGain(gl, hl, gr, hr, p.lambda, p.gamma);
        if (!best || gain > best.gain + 1e-12) {
          best = {
            feature: f,
            threshold: t,
            gain,
            missingLeft,
            left: missingLeft ? [...L, ...missing] : L,
            right: missingLeft ? R : [...R, ...missing],
          };
        }
      }
    }
  }
  return best;
}

/** One second-order tree on gradients g and hessians h. Splits with gain ≤ 0 (after γ) are refused. */
export function fitXTree(X: Matrix, g: number[], h: number[], params: XGBParams = {}, rows?: number[]): XNode {
  const { lambda = 1, gamma = 0, minChildWeight = 0, maxDepth = 3, growth = "depth", maxLeaves = Infinity, thresholds } = params;
  const p = { lambda, gamma, minChildWeight, thresholds };
  let nextId = 0;
  const make = (rs: number[], depth: number): XNode => {
    const G = rs.reduce((s, i) => s + g[i], 0);
    const H = rs.reduce((s, i) => s + h[i], 0);
    return { id: nextId++, depth, rows: rs, G, H, weight: leafWeight(G, H, lambda) };
  };
  const trySplit = (n: XNode) => {
    if (n.depth >= maxDepth) return null;
    const c = bestXSplit(X, g, h, n.rows, p);
    return c && c.gain > 0 ? c : null;
  };
  const apply = (n: XNode, c: Cand) => {
    n.split = { feature: c.feature, threshold: c.threshold, gain: c.gain, missingLeft: c.missingLeft };
    n.left = make(c.left, n.depth + 1);
    n.right = make(c.right, n.depth + 1);
  };
  const root = make(rows ?? X.map((_, i) => i), 0);
  let leaves = 1;
  if (growth === "depth") {
    let level = [root];
    while (level.length && leaves < maxLeaves) {
      const next: XNode[] = [];
      for (const n of level) {
        if (leaves >= maxLeaves) break;
        const c = trySplit(n);
        if (!c) continue;
        apply(n, c);
        leaves++;
        next.push(n.left!, n.right!);
      }
      level = next;
    }
  } else {
    const frontier: { n: XNode; c: Cand }[] = [];
    const push = (n: XNode) => {
      const c = trySplit(n);
      if (c) frontier.push({ n, c });
    };
    push(root);
    while (frontier.length && leaves < maxLeaves) {
      frontier.sort((a, b) => b.c.gain - a.c.gain);
      const { n, c } = frontier.shift()!;
      apply(n, c);
      leaves++;
      push(n.left!);
      push(n.right!);
    }
  }
  return root;
}

export function predictXTree(n: XNode, row: number[]): number {
  let cur = n;
  while (cur.split) {
    const v = row[cur.split.feature];
    const goLeft = Number.isNaN(v) ? cur.split.missingLeft : v < cur.split.threshold;
    cur = goLeft ? cur.left! : cur.right!;
  }
  return cur.weight;
}

export function xLeaves(n: XNode): XNode[] {
  return n.split ? [...xLeaves(n.left!), ...xLeaves(n.right!)] : [n];
}

export type XLoss = "squared" | "poisson" | "logistic";

/** Gradient and hessian of the loss with respect to the raw score F. */
export function gradHess(loss: XLoss, y: number, F: number): [number, number] {
  if (loss === "squared") return [F - y, 1];
  if (loss === "poisson") {
    const mu = Math.exp(F);
    return [mu - y, mu];
  }
  const p = 1 / (1 + Math.exp(-F));
  return [p - y, p * (1 - p)];
}

export type XGBModel = { base: number; lr: number; loss: XLoss; trees: XNode[] };

export function fitXGB(X: Matrix, y: number[], opts: XGBParams & { rounds?: number; lr?: number; loss?: XLoss; subsample?: number; rng?: Rng } = {}): XGBModel {
  const { rounds = 100, lr = 0.3, loss = "squared", subsample = 1, rng, ...tree } = opts;
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  const base = loss === "squared" ? mean : loss === "poisson" ? Math.log(Math.max(mean, 1e-9)) : Math.log(mean / (1 - mean));
  const F = y.map(() => base);
  const trees: XNode[] = [];
  for (let m = 0; m < rounds; m++) {
    const gh = y.map((yi, i) => gradHess(loss, yi, F[i]));
    const rows = subsample < 1 && rng ? X.map((_, i) => i).filter(() => rng() < subsample) : undefined;
    const t = fitXTree(X, gh.map((v) => v[0]), gh.map((v) => v[1]), tree, rows);
    trees.push(t);
    X.forEach((row, i) => (F[i] += lr * predictXTree(t, row)));
  }
  return { base, lr, loss, trees };
}

export function predictXGB(m: XGBModel, row: number[], upTo = m.trees.length): number {
  let F = m.base;
  for (let k = 0; k < upTo; k++) F += m.lr * predictXTree(m.trees[k], row);
  if (m.loss === "poisson") return Math.exp(F);
  if (m.loss === "logistic") return 1 / (1 + Math.exp(-F));
  return F;
}

/** Histogram mode: cut a feature into at most `bins` buckets of roughly equal counts; return the cut points. */
export function quantileCuts(values: number[], bins: number): number[] {
  const s = [...values].filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const cuts: number[] = [];
  for (let b = 1; b < bins; b++) {
    const i = Math.round((b * s.length) / bins);
    if (i <= 0 || i >= s.length) continue;
    const c = (s[i - 1] + s[i]) / 2;
    if (s[i - 1] !== s[i] && !cuts.includes(c)) cuts.push(c);
  }
  return cuts;
}

/**
 * GOSS (LightGBM): keep the top-a share of rows by |gradient|, sample a b share of the rest,
 * and up-weight the sampled small-gradient rows by (1 − a) / b so sums stay unbiased.
 */
export function goss(g: number[], a: number, b: number, rng: Rng): { rows: number[]; weights: number[] } {
  const n = g.length;
  const order = g.map((_, i) => i).sort((i, j) => Math.abs(g[j]) - Math.abs(g[i]));
  const topN = Math.round(a * n);
  const restN = Math.round(b * n);
  const top = order.slice(0, topN);
  const rest = order.slice(topN);
  // Partial Fisher–Yates shuffle to pick restN of the rest.
  for (let i = 0; i < restN; i++) {
    const j = i + Math.floor(rng() * (rest.length - i));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const sampled = rest.slice(0, restN);
  return { rows: [...top, ...sampled], weights: [...top.map(() => 1), ...sampled.map(() => (1 - a) / b)] };
}

/**
 * EFB (LightGBM): two features that are never non-zero together share one column.
 * Feature B's values are shifted past A's range so the tree can still tell them apart.
 */
export function bundleExclusive(a: number[], b: number[]): number[] {
  const offset = Math.max(...a);
  return a.map((v, i) => {
    if (v !== 0 && b[i] !== 0) throw new Error("features are not exclusive");
    return v !== 0 ? v : b[i] !== 0 ? b[i] + offset : 0;
  });
}

/** Naive target encoding: each category's mean target, computed with the row's own target included. */
export function naiveTargetEncoding(cats: string[], y: number[]): number[] {
  const sum = new Map<string, number>();
  const cnt = new Map<string, number>();
  cats.forEach((c, i) => {
    sum.set(c, (sum.get(c) ?? 0) + y[i]);
    cnt.set(c, (cnt.get(c) ?? 0) + 1);
  });
  return cats.map((c) => sum.get(c)! / cnt.get(c)!);
}

/**
 * CatBoost's ordered target statistic: walk the rows in a (random) order, and encode each row
 * using only the rows before it: (sum of earlier targets + a·prior) / (earlier count + a).
 */
export function orderedTargetStats(cats: string[], y: number[], prior: number, a = 1, order?: number[]): number[] {
  const sum = new Map<string, number>();
  const cnt = new Map<string, number>();
  const out = new Array(cats.length).fill(0);
  for (const i of order ?? cats.map((_, k) => k)) {
    const c = cats[i];
    out[i] = ((sum.get(c) ?? 0) + a * prior) / ((cnt.get(c) ?? 0) + a);
    sum.set(c, (sum.get(c) ?? 0) + y[i]);
    cnt.set(c, (cnt.get(c) ?? 0) + 1);
  }
  return out;
}

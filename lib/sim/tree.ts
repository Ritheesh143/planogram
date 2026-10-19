// CART from scratch: greedy splits, depth-wise or leaf-wise growth, and cost-complexity pruning.
// Rows go left when x[feature] < threshold, the same convention as lib/sim/boosting.ts.

import type { Matrix } from "./linalg";

export type Criterion = "sse" | "gini" | "entropy";

export type Split = {
  feature: number;
  threshold: number;
  /** Impurity of the parent minus the impurity of the two children (both as totals over rows). */
  gain: number;
  left: number[];
  right: number[];
  leftImpurity: number;
  rightImpurity: number;
};

export type TreeNode = {
  id: number;
  depth: number;
  rows: number[];
  n: number;
  /** Mean of y in the node: a prediction for regression, P(class 1) for classification. */
  value: number;
  /** Total impurity: SSE for regression, n × Gini or n × entropy for classification. */
  impurity: number;
  split?: { feature: number; threshold: number; gain: number };
  left?: TreeNode;
  right?: TreeNode;
};

export type TreeOptions = {
  criterion?: Criterion;
  maxDepth?: number;
  minLeaf?: number;
  /** "depth": split every node level by level until maxDepth. "leaf": always split the best leaf next. */
  growth?: "depth" | "leaf";
  maxLeaves?: number;
  /** Stop when the best split gains less than this. */
  minGain?: number;
};

export function gini(p: number): number {
  return 1 - p * p - (1 - p) * (1 - p);
}

export function entropy(p: number): number {
  const h = (q: number) => (q <= 0 ? 0 : -q * Math.log2(q));
  return h(p) + h(1 - p);
}

/** Total impurity of a group given its count, sum and sum of squares. */
function impurityOf(criterion: Criterion, n: number, sum: number, sumSq: number): number {
  if (n === 0) return 0;
  if (criterion === "sse") return Math.max(sumSq - (sum * sum) / n, 0);
  const p = sum / n; // labels are 0/1, so the sum counts class 1
  return n * (criterion === "gini" ? gini(p) : entropy(p));
}

export function nodeImpurity(y: number[], rows: number[], criterion: Criterion): number {
  let s = 0;
  let s2 = 0;
  for (const r of rows) {
    s += y[r];
    s2 += y[r] * y[r];
  }
  return impurityOf(criterion, rows.length, s, s2);
}

/** Every candidate split of these rows: midpoints between sorted distinct values, per feature. */
export function splitCandidates(X: Matrix, y: number[], rows: number[], criterion: Criterion = "sse", minLeaf = 1): Split[] {
  const parent = nodeImpurity(y, rows, criterion);
  const out: Split[] = [];
  const p = X[0].length;
  let total = 0;
  let totalSq = 0;
  for (const r of rows) {
    total += y[r];
    totalSq += y[r] * y[r];
  }
  for (let f = 0; f < p; f++) {
    const sorted = [...rows].sort((a, b) => X[a][f] - X[b][f]);
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      s += y[sorted[i]];
      s2 += y[sorted[i]] ** 2;
      const a = X[sorted[i]][f];
      const b = X[sorted[i + 1]][f];
      if (a === b) continue;
      const nL = i + 1;
      const nR = sorted.length - nL;
      if (nL < minLeaf || nR < minLeaf) continue;
      const leftImpurity = impurityOf(criterion, nL, s, s2);
      const rightImpurity = impurityOf(criterion, nR, total - s, totalSq - s2);
      out.push({
        feature: f,
        threshold: (a + b) / 2,
        gain: parent - leftImpurity - rightImpurity,
        left: sorted.slice(0, nL),
        right: sorted.slice(nL),
        leftImpurity,
        rightImpurity,
      });
    }
  }
  return out;
}

export function bestSplit(X: Matrix, y: number[], rows: number[], criterion: Criterion = "sse", minLeaf = 1): Split | null {
  let best: Split | null = null;
  for (const c of splitCandidates(X, y, rows, criterion, minLeaf)) {
    if (!best || c.gain > best.gain + 1e-12) best = c;
  }
  return best;
}

export function fitTree(X: Matrix, y: number[], opts: TreeOptions = {}): TreeNode {
  const { criterion = "sse", maxDepth = 3, minLeaf = 1, growth = "depth", maxLeaves = Infinity, minGain = 1e-12 } = opts;
  let nextId = 0;
  const makeNode = (rows: number[], depth: number): TreeNode => ({
    id: nextId++,
    depth,
    rows,
    n: rows.length,
    value: rows.reduce((s, r) => s + y[r], 0) / rows.length,
    impurity: nodeImpurity(y, rows, criterion),
  });
  const trySplit = (node: TreeNode) => (node.depth >= maxDepth ? null : bestSplit(X, y, node.rows, criterion, minLeaf));
  const apply = (node: TreeNode, s: Split) => {
    node.split = { feature: s.feature, threshold: s.threshold, gain: s.gain };
    node.left = makeNode(s.left, node.depth + 1);
    node.right = makeNode(s.right, node.depth + 1);
  };

  const root = makeNode(X.map((_, i) => i), 0);
  if (growth === "depth") {
    let leaves = 1;
    let level = [root];
    while (level.length > 0) {
      const next: TreeNode[] = [];
      for (const node of level) {
        if (leaves >= maxLeaves) break;
        const s = trySplit(node);
        if (!s || s.gain < minGain) continue;
        apply(node, s);
        leaves++;
        next.push(node.left!, node.right!);
      }
      level = next;
    }
  } else {
    // Leaf-wise (best-first): among all current leaves, split the one with the biggest gain.
    const frontier: { node: TreeNode; split: Split }[] = [];
    const push = (node: TreeNode) => {
      const s = trySplit(node);
      if (s && s.gain >= minGain) frontier.push({ node, split: s });
    };
    push(root);
    let leaves = 1;
    while (frontier.length > 0 && leaves < maxLeaves) {
      frontier.sort((a, b) => b.split.gain - a.split.gain);
      const { node, split } = frontier.shift()!;
      apply(node, split);
      leaves++;
      push(node.left!);
      push(node.right!);
    }
  }
  return root;
}

export function predictTree(node: TreeNode, row: number[]): number {
  let cur = node;
  while (cur.split) cur = row[cur.split.feature] < cur.split.threshold ? cur.left! : cur.right!;
  return cur.value;
}

export function leaves(node: TreeNode): TreeNode[] {
  return node.split ? [...leaves(node.left!), ...leaves(node.right!)] : [node];
}

export function treeDepth(node: TreeNode): number {
  return node.split ? 1 + Math.max(treeDepth(node.left!), treeDepth(node.right!)) : 0;
}

/** Total impurity of the leaves: the training error the tree is left with. */
export function leafImpurity(node: TreeNode): number {
  return leaves(node).reduce((s, l) => s + l.impurity, 0);
}

/**
 * Cost-complexity pruning: the subtree that minimizes (leaf impurity) + α × (number of leaves).
 * Bottom-up, each node keeps its children only if they beat turning it into a single leaf.
 */
export function prune(node: TreeNode, alpha: number): TreeNode {
  const best = (n: TreeNode): { tree: TreeNode; cost: number } => {
    const asLeaf = { tree: { ...n, split: undefined, left: undefined, right: undefined }, cost: n.impurity + alpha };
    if (!n.split) return asLeaf;
    const l = best(n.left!);
    const r = best(n.right!);
    const keep = l.cost + r.cost;
    return keep < asLeaf.cost ? { tree: { ...n, left: l.tree, right: r.tree }, cost: keep } : asLeaf;
  };
  return best(node).tree;
}

export type Region = { lo: number[]; hi: number[]; value: number; n: number; id: number };

/** The box each leaf owns, for drawing a tree as a partition of feature space. */
export function regions(node: TreeNode, lo: number[], hi: number[]): Region[] {
  if (!node.split) return [{ lo, hi, value: node.value, n: node.n, id: node.id }];
  const { feature, threshold } = node.split;
  const leftHi = [...hi];
  leftHi[feature] = Math.min(hi[feature], threshold);
  const rightLo = [...lo];
  rightLo[feature] = Math.max(lo[feature], threshold);
  return [...regions(node.left!, lo, leftHi), ...regions(node.right!, rightLo, hi)];
}

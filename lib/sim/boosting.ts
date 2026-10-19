// Gradient boosting with decision stumps on one feature, written to be read.

export type Stump = {
  threshold: number;
  left: number; // value predicted for x < threshold
  right: number; // value predicted for x >= threshold
  sse: number;
};

export type Candidate = { threshold: number; sse: number; left: number; right: number };

function sse(values: number[], center: number): number {
  return values.reduce((a, v) => a + (v - center) ** 2, 0);
}

const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Try every midpoint between sorted x values; keep the split with the lowest squared error. */
export function splitCandidates(x: number[], target: number[]): Candidate[] {
  const xs = [...new Set(x)].sort((a, b) => a - b);
  const out: Candidate[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const threshold = (xs[i] + xs[i + 1]) / 2;
    const L = target.filter((_, j) => x[j] < threshold);
    const R = target.filter((_, j) => x[j] >= threshold);
    const left = avg(L);
    const right = avg(R);
    out.push({ threshold, left, right, sse: sse(L, left) + sse(R, right) });
  }
  return out;
}

export function fitStump(x: number[], target: number[]): Stump {
  const cands = splitCandidates(x, target);
  return cands.reduce((best, c) => (c.sse < best.sse ? c : best));
}

export function predictStump(s: Stump, xi: number): number {
  return xi < s.threshold ? s.left : s.right;
}

export type Round = {
  /** Prediction for each row after this round. */
  pred: number[];
  /** Residuals y - pred after this round (what the next tree will fit). */
  residuals: number[];
  /** The stump fitted in this round (undefined for round 0, the constant). */
  stump?: Stump;
  candidates?: Candidate[];
  sse: number;
};

/** Round 0 predicts the mean; each later round fits a stump to the residuals and adds lr × stump. */
export function boost(x: number[], y: number[], rounds: number, lr: number): Round[] {
  const base = avg(y);
  let pred = y.map(() => base);
  const history: Round[] = [];
  const residualsOf = (p: number[]) => y.map((yi, i) => yi - p[i]);
  history.push({ pred, residuals: residualsOf(pred), sse: sse(residualsOf(pred), 0) });
  for (let r = 1; r <= rounds; r++) {
    const res = residualsOf(pred);
    const candidates = splitCandidates(x, res);
    const stump = candidates.reduce((best, c) => (c.sse < best.sse ? c : best));
    pred = pred.map((p, i) => p + lr * predictStump(stump, x[i]));
    const next = residualsOf(pred);
    history.push({ pred, residuals: next, stump, candidates, sse: sse(next, 0) });
  }
  return history;
}

/** Ensemble prediction at any x after `round` rounds. */
export function predictAt(history: Round[], y: number[], lr: number, round: number, xi: number): number {
  let p = avg(y);
  for (let r = 1; r <= round; r++) p += lr * predictStump(history[r].stump!, xi);
  return p;
}

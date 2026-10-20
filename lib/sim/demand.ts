// Hard demand and global models: the numbers behind Signature B, batch 2b. Stockouts that censor
// demand (fc-censored-demand), Croston and TSB for slow movers (fc-intermittent), a global boosted
// model with the Tweedie loss (fc-tweedie-lgbm) and hierarchical reconciliation (fc-mint).

import { solve, type Matrix } from "./linalg";
import { logFactorial } from "./prob";
import { gamma as gammaDraw, mulberry32, normal, poisson, type Rng } from "./rng";
import { fitXTree, predictXTree, type XNode } from "./xgb";

export const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
export function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

// ---------- fc-censored-demand ----------

export const logPmf = (k: number, lambda: number) => k * Math.log(lambda) - lambda - logFactorial(k);

/** P(D ≥ c) for D ~ Poisson(λ). */
export function tail(c: number, lambda: number): number {
  let cdf = 0;
  for (let k = 0; k < c; k++) cdf += Math.exp(logPmf(k, lambda));
  return Math.max(1 - cdf, 1e-300);
}

/** The ten days worked by hand: the shelf holds 12, so a 12 means it sold out. */
export const HAND_SHELF = 12;
export const HAND_SALES = [9, 12, 11, 12, 8, 12, 12, 10, 12, 11];

/**
 * Censored Poisson log-likelihood: a day that didn't sell out says demand was exactly y; a day that
 * sold out (sales = shelf) only says demand was at least the shelf.
 */
export function censoredLogLik(sales: number[], shelf: number, lambda: number): number {
  return sales.reduce((s, y) => s + (y >= shelf ? Math.log(tail(shelf, lambda)) : logPmf(y, lambda)), 0);
}

/**
 * The λ that maximizes the censored likelihood (golden-section search, rounded to 0.01). Only three
 * numbers matter: the total of the full days, how many there were, and how many sold out.
 */
export function censoredMLE(sales: number[], shelf: number, lo = 0.5, hi = 60): number {
  let sum = 0;
  let open = 0;
  let out = 0;
  for (const y of sales) {
    if (y >= shelf) out++;
    else {
      sum += y;
      open++;
    }
  }
  const ll = (l: number) => sum * Math.log(l) - open * l + (out ? out * Math.log(tail(shelf, l)) : 0);
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = ll(c);
  let fd = ll(d);
  while (b - a > 1e-6) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = ll(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = ll(d);
    }
  }
  return Number(((a + b) / 2).toFixed(2));
}

export function estimates(sales: number[], shelf: number) {
  const open = sales.filter((y) => y < shelf);
  return {
    naive: mean(sales),
    dropped: open.length ? mean(open) : NaN,
    mle: censoredMLE(sales, shelf),
    stockouts: sales.filter((y) => y >= shelf).length / sales.length,
  };
}

/** n days of Poisson(λ) demand on a shelf that holds `shelf` units: what sold, and what was wanted. */
export function shelfDays(lambda: number, shelf: number, n: number, seed: number) {
  const rng = mulberry32(seed);
  const demand = Array.from({ length: n }, () => poisson(rng, lambda));
  return { demand, sales: demand.map((d) => Math.min(d, shelf)) };
}

/** The censored MLE when each day had its own shelf size. */
export function mleVaryingShelf(sales: number[], shelves: number[]): number {
  const ll = (l: number) => sales.reduce((s, y, i) => s + (y >= shelves[i] ? Math.log(tail(shelves[i], l)) : y * Math.log(l) - l), 0);
  let a = 0.5;
  let b = 60;
  const g = (Math.sqrt(5) - 1) / 2;
  while (b - a > 1e-6) {
    const c = b - g * (b - a);
    const d = a + g * (b - a);
    if (ll(c) > ll(d)) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/** E[D | D ≥ c] for Poisson(λ): the expected demand on a day that sold out (the EM imputation). */
export function conditionalMean(c: number, lambda: number): number {
  let num = 0;
  for (let k = 0; k < c; k++) num += k * Math.exp(logPmf(k, lambda));
  return (lambda - num) / tail(c, lambda);
}

/** Expected sales on a shelf of size c when demand is Poisson(λ): E[min(D, c)]. */
export function expectedSales(lambda: number, c: number): number {
  let s = 0;
  for (let k = 0; k < c; k++) s += k * Math.exp(logPmf(k, lambda));
  return s + c * tail(c, lambda);
}

/**
 * Average each estimator over many 28-day histories, for each shelf size. Returns the mean estimate
 * and its sd, so the bias shows directly.
 */
export function censorStudy(lambda: number, shelves: number[], histories: number, seed: number) {
  const rng = mulberry32(seed);
  return shelves.map((shelf) => {
    const naive: number[] = [];
    const dropped: number[] = [];
    const mle: number[] = [];
    for (let h = 0; h < histories; h++) {
      const sales = Array.from({ length: 28 }, () => Math.min(poisson(rng, lambda), shelf));
      const e = estimates(sales, shelf);
      naive.push(e.naive);
      if (!Number.isNaN(e.dropped)) dropped.push(e.dropped);
      mle.push(e.mle);
    }
    return { shelf, stockout: tail(shelf, lambda), naive: mean(naive), dropped: mean(dropped), mle: mean(mle), mleSd: sd(mle), naiveSd: sd(naive) };
  });
}

/**
 * The replenishment spiral. Each week the shelf is set to the forecast rounded up (no buffer), and
 * the forecast is re-estimated from the last 28 days, either from raw sales or from the censored
 * likelihood. Returns the shelf size and the share of demand lost, week by week.
 */
export function spiral(lambda: number, weeks: number, method: "naive" | "mle", seed: number, start = Math.ceil(lambda)) {
  const rng = mulberry32(seed);
  const hist: number[] = [];
  const shelves: number[] = [];
  const histShelf: number[] = [];
  let shelf = start;
  let lost = 0;
  let wanted = 0;
  const lostByWeek: number[] = [];
  for (let w = 0; w < weeks; w++) {
    let wl = 0;
    let ww = 0;
    for (let d = 0; d < 7; d++) {
      const dem = poisson(rng, lambda);
      const sold = Math.min(dem, shelf);
      hist.push(sold);
      histShelf.push(shelf);
      wl += dem - sold;
      ww += dem;
    }
    lost += wl;
    wanted += ww;
    lostByWeek.push(wl / ww);
    shelves.push(shelf);
    const recent = hist.slice(-28);
    const recentShelf = histShelf.slice(-28);
    let f: number;
    if (method === "naive") f = mean(recent);
    else {
      // Shelves can differ day to day: each day is censored at its own shelf.
      f = mleVaryingShelf(recent, recentShelf);
    }
    shelf = Math.ceil(f - 1e-9);
  }
  return { shelves, lostShare: lost / wanted, lostByWeek };
}

// ---------- fc-intermittent ----------

/** Twelve weeks of a premium drill's sales, worked by hand. */
export const HAND_DRILL = [0, 0, 3, 0, 0, 0, 2, 0, 4, 0, 0, 0];

export type Smoother = { forecast: number[]; final: number };

/** Simple exponential smoothing; forecast[t] is the forecast for period t made after period t − 1. */
export function sesForecasts(y: number[], alpha: number, init = y[0]): number[] {
  const out: number[] = [];
  let l = init;
  for (const v of y) {
    out.push(l);
    l = l + alpha * (v - l);
  }
  out.push(l);
  return out;
}

/**
 * Croston: smooth the size of each sale (z) and the gap between sales (p) separately, updating both
 * only in weeks with a sale. Forecast = z / p (times 1 − α/2 for the Syntetos–Boylan correction).
 * Starts from the first sale: z = its size, p = the weeks it took to arrive.
 */
export function croston(y: number[], alpha: number, sba = false) {
  const first = y.findIndex((v) => v > 0);
  const out: (number | null)[] = [];
  const zs: (number | null)[] = [];
  const ps: (number | null)[] = [];
  if (first < 0) return { forecast: y.map(() => 0).concat(0), z: [], p: [] };
  let z = y[first];
  let p = first + 1;
  let gap = 0;
  for (let t = 0; t < y.length; t++) {
    out.push(t <= first ? null : ((sba ? 1 - alpha / 2 : 1) * z) / p);
    zs.push(t <= first ? null : z);
    ps.push(t <= first ? null : p);
    if (t <= first) continue;
    gap++;
    if (y[t] > 0) {
      z = z + alpha * (y[t] - z);
      p = p + alpha * (gap - p);
      gap = 0;
    }
  }
  out.push(((sba ? 1 - alpha / 2 : 1) * z) / p);
  return { forecast: out, z: zs.concat(z), p: ps.concat(p) };
}

/**
 * TSB (Teunter–Syntetos–Babai): smooth the chance of a sale every week (β) and the size of a sale in
 * weeks with one (α). Forecast = chance × size, so the forecast decays if sales stop.
 */
export function tsb(y: number[], alpha: number, beta: number) {
  const first = y.findIndex((v) => v > 0);
  const out: (number | null)[] = [];
  const ds: (number | null)[] = [];
  if (first < 0) return { forecast: y.map(() => 0).concat(0), d: [] };
  let z = y[first];
  let d = 1 / (first + 1);
  for (let t = 0; t < y.length; t++) {
    out.push(t <= first ? null : d * z);
    ds.push(t <= first ? null : d);
    if (t <= first) continue;
    d = d + beta * ((y[t] > 0 ? 1 : 0) - d);
    if (y[t] > 0) z = z + alpha * (y[t] - z);
  }
  out.push(d * z);
  return { forecast: out, d: ds.concat(d) };
}

/** The drill: a sale in 30% of weeks, of 1 + Poisson(1.5) units. Mean 0.75 a week. Discontinued after `stopAt`. */
export const DRILL = { p: 0.3, extra: 1.5, weeks: 104, stopAt: 78 };
export const drillMean = DRILL.p * (1 + DRILL.extra);

export function drillSeries(seed: number, weeks = DRILL.weeks, stopAt = DRILL.stopAt, rng: Rng = mulberry32(seed)): number[] {
  return Array.from({ length: weeks }, (_, t) => {
    const sale = rng() < DRILL.p;
    const size = 1 + poisson(rng, DRILL.extra);
    return t < stopAt && sale ? size : 0;
  });
}

/** Average demand interval (ADI) and squared coefficient of variation of non-zero sizes (CV²). */
export function classify(y: number[]) {
  const nz = y.filter((v) => v > 0);
  const adi = y.length / nz.length;
  const m = mean(nz);
  const v = nz.reduce((s, x) => s + (x - m) ** 2, 0) / nz.length;
  const cv2 = v / (m * m);
  const kind = adi < 1.32 ? (cv2 < 0.49 ? "smooth" : "erratic") : cv2 < 0.49 ? "intermittent" : "lumpy";
  return { adi, cv2, kind };
}

/**
 * Each method on many stationary drill series (no discontinuation): its average forecast over weeks
 * 20–200 against the true mean of 0.75 (bias), and how far its forecast typically sits from 0.75 in
 * any one week (RMSE, which includes the sawtooth of SES around each sale).
 */
export function intermittentStudy(series: number, alpha: number, seed: number) {
  const rng = mulberry32(seed);
  const names = ["ses", "croston", "sba", "tsb"] as const;
  const avg = Object.fromEntries(names.map((k) => [k, [] as number[]])) as Record<(typeof names)[number], number[]>;
  const sq = Object.fromEntries(names.map((k) => [k, [] as number[]])) as Record<(typeof names)[number], number[]>;
  for (let s = 0; s < series; s++) {
    const y = drillSeries(0, 200, 200, rng);
    if (y.findIndex((v) => v > 0) > 15) continue;
    const f = {
      ses: sesForecasts(y, alpha, drillMean),
      croston: croston(y, alpha).forecast,
      sba: croston(y, alpha, true).forecast,
      tsb: tsb(y, alpha, alpha).forecast,
    };
    for (const k of names) {
      const w = f[k].slice(20, 200).map((v) => v ?? 0);
      avg[k].push(mean(w));
      sq[k].push(mean(w.map((v) => (v - drillMean) ** 2)));
    }
  }
  return Object.fromEntries(names.map((k) => [k, { mean: mean(avg[k]), rmse: Math.sqrt(mean(sq[k])) }])) as Record<(typeof names)[number], { mean: number; rmse: number }>;
}

// ---------- fc-tweedie-lgbm ----------

/** Tweedie negative log-likelihood (up to terms without μ) with log link F = log μ, power p in (1, 2). */
export function tweedieLoss(y: number, F: number, p: number): number {
  return (-y * Math.exp((1 - p) * F)) / (1 - p) + Math.exp((2 - p) * F) / (2 - p);
}
/** Its gradient and hessian with respect to F (what LightGBM's `tweedie` objective computes). */
export function tweedieGradHess(y: number, F: number, p: number): [number, number] {
  const a = Math.exp((1 - p) * F);
  const b = Math.exp((2 - p) * F);
  return [-y * a + b, -(1 - p) * y * a + (2 - p) * b];
}

/** Tweedie unit deviance: 2 × (log-likelihood of a perfect fit − of μ). Defined for y = 0 too. */
export function tweedieDeviance(y: number, mu: number, p: number): number {
  const t1 = y > 0 ? (y ** (2 - p)) / ((1 - p) * (2 - p)) : 0;
  return 2 * (t1 - (y * mu ** (1 - p)) / (1 - p) + mu ** (2 - p) / (2 - p));
}

/** Compound Poisson–gamma draw: N ~ Poisson(λ) purchases, each Gamma(shape, scale). */
export function compoundDraw(rng: Rng, lambda: number, shape: number, scale: number): number {
  const n = poisson(rng, lambda);
  let s = 0;
  for (let i = 0; i < n; i++) s += gammaDraw(rng, shape, scale);
  return s;
}

/** Tweedie(μ, φ, p) as compound Poisson–gamma: λ = μ^(2−p)/(φ(2−p)), shape (2−p)/(p−1), scale φ(p−1)μ^(p−1). */
export function tweedieParams(mu: number, phi: number, p: number) {
  return { lambda: mu ** (2 - p) / (phi * (2 - p)), shape: (2 - p) / (p - 1), scale: phi * (p - 1) * mu ** (p - 1) };
}

/** The chain panel: stores × SKUs × days, with multiplicative store, SKU, weekday and promo effects. */
export const PANEL = { stores: 8, skus: 12, days: 70, trainDays: 56, promoLift: 0.7, basket: 2.5 };
export const STORE_FX = [0.35, 0.2, 0.1, 0, 0, -0.1, -0.25, -0.4];
/** SKU effects run from a fast mover (about 18 a day) down to slow movers (about 0.15 a day). */
export const SKU_FX = [2.9, 2.4, 1.9, 1.5, 1.1, 0.7, 0.3, 0, -0.4, -0.8, -1.3, -1.9];
export const DOW_FX = [-0.2, -0.25, -0.15, -0.1, 0.05, 0.4, 0.25];

export type PanelRow = { store: number; sku: number; day: number; dow: number; promo: number; mu: number; y: number };

/**
 * Units sold per store × SKU × day. A day's demand is Poisson(μ / 2.5) shopper baskets that each take
 * 1 + Poisson(1.5) units: compound Poisson, mean μ, lots of zeros for slow SKUs. Promotions run on
 * random days (one in eight) per SKU.
 */
export function panel(seed: number): PanelRow[] {
  const rng = mulberry32(seed);
  const promo = Array.from({ length: PANEL.skus }, () => Array.from({ length: PANEL.days }, () => (rng() < 0.125 ? 1 : 0)));
  const rows: PanelRow[] = [];
  for (let s = 0; s < PANEL.stores; s++)
    for (let k = 0; k < PANEL.skus; k++)
      for (let d = 0; d < PANEL.days; d++) {
        const dow = d % 7;
        const pr = promo[k][d];
        const mu = Math.exp(STORE_FX[s] + SKU_FX[k] + DOW_FX[dow] + PANEL.promoLift * pr);
        const n = poisson(rng, mu / PANEL.basket);
        let y = 0;
        for (let i = 0; i < n; i++) y += 1 + poisson(rng, PANEL.basket - 1);
        rows.push({ store: s, sku: k, day: d, dow, promo: pr, mu, y });
      }
  return rows;
}

export type BoostLoss = "squared" | "poisson" | "tweedie";

/** Sufficient statistics per feature cell: every row in a cell gets the same prediction. */
function cells(rows: PanelRow[]) {
  const map = new Map<string, { x: number[]; n: number; sy: number }>();
  for (const r of rows) {
    const key = `${r.store}|${r.sku}|${r.dow}|${r.promo}`;
    const c = map.get(key) ?? { x: [r.store, r.sku, r.dow, r.promo], n: 0, sy: 0 };
    c.n++;
    c.sy += r.y;
    map.set(key, c);
  }
  return [...map.values()];
}

export type Booster = { loss: BoostLoss; p: number; base: number; lr: number; trees: XNode[] };

/**
 * A global gradient-boosted model, second order, on store / SKU / weekday / promo. Squared loss
 * boosts sales directly; Poisson and Tweedie boost log sales (log link), like LightGBM's objectives.
 * Gradients are summed per feature cell, which is exact because every row in a cell shares F.
 */
export function fitBooster(rows: PanelRow[], loss: BoostLoss, rounds = 120, lr = 0.1, p = 1.3, maxDepth = 4): Booster {
  const cs = cells(rows);
  const X: Matrix = cs.map((c) => c.x);
  const tot = cs.reduce((s, c) => s + c.sy, 0) / cs.reduce((s, c) => s + c.n, 0);
  const base = loss === "squared" ? tot : Math.log(tot);
  const F = cs.map(() => base);
  const thresholds = [0, 1, 2, 3].map((f) => {
    const vals = [...new Set(X.map((x) => x[f]))].sort((a, b) => a - b);
    return vals.slice(0, -1).map((v, i) => (v + vals[i + 1]) / 2);
  });
  const trees: XNode[] = [];
  for (let m = 0; m < rounds; m++) {
    const g: number[] = [];
    const h: number[] = [];
    cs.forEach((c, i) => {
      if (loss === "squared") {
        g.push(c.n * F[i] - c.sy);
        h.push(c.n);
      } else {
        const pp = loss === "poisson" ? 1 : p;
        const a = Math.exp((1 - pp) * F[i]);
        const b = Math.exp((2 - pp) * F[i]);
        g.push(-c.sy * a + c.n * b);
        h.push(-(1 - pp) * c.sy * a + c.n * (2 - pp) * b);
      }
    });
    const t = fitXTree(X, g, h, { lambda: 1, maxDepth, thresholds });
    trees.push(t);
    X.forEach((x, i) => (F[i] += lr * predictXTree(t, x)));
  }
  return { loss, p, base, lr, trees };
}

export function predictBooster(m: Booster, r: { store: number; sku: number; dow: number; promo: number }, upTo = m.trees.length): number {
  const x = [r.store, r.sku, r.dow, r.promo];
  let F = m.base;
  for (let k = 0; k < upTo; k++) F += m.lr * predictXTree(m.trees[k], x);
  return m.loss === "squared" ? F : Math.exp(F);
}

/**
 * Test error after every `every` rounds: WAPE against what sold, and the average distance from the
 * true demand rate μ as a share of μ (only a simulation can score that one).
 */
export function boostCurve(m: Booster, test: PanelRow[], every = 10) {
  const F = test.map(() => m.base);
  const out: { rounds: number; wape: number; truth: number; negatives: number }[] = [];
  const sumY = test.reduce((s, r) => s + r.y, 0);
  for (let k = 0; k < m.trees.length; k++) {
    test.forEach((r, i) => (F[i] += m.lr * predictXTree(m.trees[k], [r.store, r.sku, r.dow, r.promo])));
    if ((k + 1) % every === 0) {
      const pred = F.map((f) => (m.loss === "squared" ? f : Math.exp(f)));
      out.push({
        rounds: k + 1,
        wape: test.reduce((s, r, i) => s + Math.abs(r.y - pred[i]), 0) / sumY,
        truth: mean(test.map((r, i) => Math.abs(pred[i] - r.mu) / r.mu)),
        negatives: pred.filter((v) => v < 0).length,
      });
    }
  }
  return out;
}

// ---------- fc-mint ----------

/** Solve for the inverse of a small matrix, column by column. */
export function inverse(A: Matrix): Matrix {
  const n = A.length;
  const cols = Array.from({ length: n }, (_, j) => solve(A, Array.from({ length: n }, (_, i) => (i === j ? 1 : 0))));
  return Array.from({ length: n }, (_, i) => cols.map((c) => c[i]));
}

const mul = (A: Matrix, B: Matrix): Matrix => A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
const tr = (A: Matrix): Matrix => A[0].map((_, j) => A.map((r) => r[j]));

/**
 * Reconcile base forecasts ŷ for a hierarchy with summing matrix S, weighting each node by 1/W:
 * b̃ = (Sᵀ W⁻¹ S)⁻¹ Sᵀ W⁻¹ ŷ and ỹ = S b̃. W = I is OLS; W = diag(error variances) is MinT's WLS
 * version; the full error covariance is MinT proper.
 */
export function reconcile(S: Matrix, yhat: number[], w: number[]): number[] {
  const Winv = w.map((v) => 1 / v);
  const StW = tr(S).map((row) => row.map((v, i) => v * Winv[i]));
  const A = mul(StW, S);
  const rhs = StW.map((row) => row.reduce((s, v, i) => s + v * yhat[i], 0));
  const b = solve(A, rhs);
  return S.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
}

/** The three-node hierarchy by hand: Total = A + B. */
export const S3: Matrix = [
  [1, 1],
  [1, 0],
  [0, 1],
];
export const HAND_MINT = { total: 100, a: 60, b: 45, varTotal: 25, varA: 16, varB: 9 };

export type ReconMethod = "base" | "bottomup" | "topdown" | "ols" | "wls";

/** Reconcile the three-node example by each method. Top-down splits the total by the bottom forecasts' shares. */
export function reconcile3(yhat: number[], vars: number[], method: ReconMethod): number[] {
  const [t, a, b] = yhat;
  if (method === "base") return [...yhat];
  if (method === "bottomup") return [a + b, a, b];
  if (method === "topdown") return [t, (t * a) / (a + b), (t * b) / (a + b)];
  return reconcile(S3, yhat, method === "ols" ? [1, 1, 1] : vars);
}

/** Two regions of two stores each: rows Total, North, South, N1, N2, S1, S2. */
export const S7: Matrix = [
  [1, 1, 1, 1],
  [1, 1, 0, 0],
  [0, 0, 1, 1],
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
export const NODES = ["Total", "North", "South", "N1", "N2", "S1", "S2"];

/**
 * Each node of the hierarchy has its own forecaster, and each makes its own independent error (sd
 * per node below). Reconciliation moves every forecast by P(ŷ − y) − (ŷ − y), since PS = S, so the
 * errors are all that matter: simulate them and measure the RMSE at each level, by method.
 */
export const MINT_SD = [25, 20, 20, 15, 15, 15, 15];

export function mintStudy(reps: number, seed: number, sds = MINT_SD) {
  const rng = mulberry32(seed);
  const vars = sds.map((v) => v * v);
  const methods = ["base", "bottomup", "ols", "wls"] as const;
  const sq = Object.fromEntries(methods.map((m) => [m, NODES.map(() => 0)])) as Record<(typeof methods)[number], number[]>;
  for (let k = 0; k < reps; k++) {
    const e = sds.map((v) => normal(rng, 0, v));
    const out = {
      base: e,
      bottomup: S7.map((row) => row.reduce((s, v, j) => s + v * e[3 + j], 0)),
      ols: reconcile(S7, e, NODES.map(() => 1)),
      wls: reconcile(S7, e, vars),
    };
    for (const m of methods) out[m].forEach((v, i) => (sq[m][i] += (v * v) / reps));
  }
  const level = (v: number[], idx: number[]) => Math.sqrt(mean(idx.map((i) => v[i])));
  return Object.fromEntries(methods.map((m) => [m, { total: level(sq[m], [0]), regions: level(sq[m], [1, 2]), stores: level(sq[m], [3, 4, 5, 6]) }])) as Record<
    (typeof methods)[number],
    { total: number; regions: number; stores: number }
  >;
}

/** The exact reconciled error sd at each node: the diagonal of P W Pᵀ, where P maps base forecasts to reconciled ones. */
export function reconciledSd(S: Matrix, w: number[], sds: number[]): number[] {
  const n = S.length;
  const P = Array.from({ length: n }, (_, j) => reconcile(S, Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)), w));
  // P[j] is column j of the projection (the reconciled forecast when only node j's base forecast is 1).
  return Array.from({ length: n }, (_, i) => Math.sqrt(P.reduce((s, col, j) => s + col[i] ** 2 * sds[j] ** 2, 0)));
}

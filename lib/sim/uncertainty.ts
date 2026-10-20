// Batch 2c: uncertainty to production. Pinball loss and conformal intervals, promotions and the
// post-promo dip, global forecasters (the idea under DeepAR and foundation models), and turning a
// forecast distribution into an order. Every number a lesson quotes is computed here.

import { logGamma } from "./bayes";
import { solve } from "./linalg";
import { normalQuantile } from "./prob";
import { mulberry32, negBinomial, normal, poisson, type Rng } from "./rng";

export const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

/** The q-quantile of a sample (linear interpolation between order statistics). */
export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = q * (s.length - 1);
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error below 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

// ---------- distributions ----------

/** Negative binomial pmf with mean m and dispersion k (variance m + m²/k). */
export function nbPmf(y: number, m: number, k: number): number {
  if (y < 0) return 0;
  return Math.exp(logGamma(y + k) - logGamma(k) - logGamma(y + 1) + k * Math.log(k / (k + m)) + y * Math.log(m / (k + m)));
}

/** P(Y ≤ y) under the negative binomial. */
export function nbCdf(y: number, m: number, k: number): number {
  let s = 0;
  for (let i = 0; i <= y; i++) s += nbPmf(i, m, k);
  return Math.min(s, 1);
}

/** Smallest y with P(Y ≤ y) ≥ p under the negative binomial. */
export function nbQuantile(p: number, m: number, k: number): number {
  let s = 0;
  for (let y = 0; ; y++) {
    s += nbPmf(y, m, k);
    if (s >= p - 1e-12) return y;
  }
}

export function poissonPmf(y: number, m: number): number {
  if (y < 0) return 0;
  return Math.exp(y * Math.log(m) - m - logGamma(y + 1));
}

export function poissonCdf(y: number, m: number): number {
  let s = 0;
  for (let i = 0; i <= y; i++) s += poissonPmf(i, m);
  return Math.min(s, 1);
}

export function poissonQuantile(p: number, m: number): number {
  let s = 0;
  for (let y = 0; ; y++) {
    s += poissonPmf(y, m);
    if (s >= p - 1e-12) return y;
  }
}

// ---------- fc-pinball: pinball loss ----------

/** Pinball loss summed over sales y for the forecast q at level τ. */
export function pinballTotal(y: number[], q: number, tau: number): number {
  return y.reduce((s, v) => s + (v > q ? tau * (v - q) : (1 - tau) * (q - v)), 0);
}

/** The whole number q that minimizes the pinball total (the smallest one if several tie). */
export function pinballArgmin(y: number[], tau: number): number {
  let best = 0;
  let bestL = Infinity;
  for (let q = Math.floor(Math.min(...y)); q <= Math.ceil(Math.max(...y)); q++) {
    const l = pinballTotal(y, q, tau);
    if (l < bestL - 1e-9) {
      best = q;
      bestL = l;
    }
  }
  return best;
}

/** Ten days of sales of a tinting base at the paint counter. */
export const HAND_TINS = [6, 12, 3, 9, 18, 7, 10, 5, 8, 6];
export const PB = { days: 200, mean: 8, k: 3, seed: 6 };

/** Simulated daily sales of the tinting base (negative binomial: a long right tail). */
export function tintDays(n = PB.days, seed = PB.seed): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => negBinomial(rng, PB.mean, PB.k));
}

// ---------- fc-pinball: conformal intervals ----------

/** Weekly demand is negative binomial around a forecast of 20; the model assumes Poisson. */
export const CF = { mu: 20, k: 5, alpha: 0.2 };
/** Absolute forecast errors on nine calibration weeks. */
export const HAND_RESID = [2, 7, 3, 11, 5, 14, 3, 8, 6];

/** Split conformal: the ⌈(n + 1)(1 − α)⌉-th smallest absolute error (infinite if that rank exceeds n). */
export function conformalQ(resid: number[], alpha: number): number {
  const n = resid.length;
  const rank = Math.ceil((n + 1) * (1 - alpha) - 1e-9);
  if (rank > n) return Infinity;
  return [...resid].sort((a, b) => a - b)[rank - 1];
}

/** P(lo ≤ Y ≤ hi) under the negative binomial. */
export function nbCover(lo: number, hi: number, m = CF.mu, k = CF.k): number {
  return nbCdf(Math.floor(hi), m, k) - nbCdf(Math.ceil(lo) - 1, m, k);
}

/** The model's own (1 − α) interval: Poisson quantiles around the forecast. */
export function poissonInterval(m = CF.mu, alpha = CF.alpha): [number, number] {
  return [poissonQuantile(alpha / 2, m), poissonQuantile(1 - alpha / 2, m)];
}

/** Rerun the calibration many times: the coverage each conformal interval achieves on future weeks. */
export function conformalStudy(n: number, reps: number, seed: number) {
  const rng = mulberry32(seed);
  const coverage: number[] = [];
  const widths: number[] = [];
  for (let r = 0; r < reps; r++) {
    const resid = Array.from({ length: n }, () => Math.abs(negBinomial(rng, CF.mu, CF.k) - CF.mu));
    const q = conformalQ(resid, CF.alpha);
    coverage.push(nbCover(CF.mu - q, CF.mu + q));
    widths.push(2 * q + 1);
  }
  return { coverage, mean: mean(coverage), low: coverage.filter((c) => c < 0.75).length / reps, width: mean(widths) };
}

// ---------- fc-promotions ----------

/** Deck stain: 100 a week at full price, ₹200 a tin, ₹120 to buy. */
export const PROMO = { base: 100, price: 200, cost: 120, elasticity: Math.log(2.2) / Math.log(1 / 0.75), depth: 0.25, pull: 0.4, dipWeeks: 3 };

/** Extra units in the promo week: base × ((1 − depth)^(−ε) − 1). */
export function promoLift(depth: number, base = PROMO.base, eps = PROMO.elasticity): number {
  return base * ((1 - depth) ** -eps - 1);
}

/**
 * One promo: the lift, the pulled-forward units repaid evenly over the dip weeks, and what it does to
 * profit against selling 100 a week at full price. `weeks` runs from two weeks before to six after.
 */
export function promoEffect(depth: number, pull: number, dipWeeks: number, p = PROMO) {
  const lift = promoLift(depth, p.base, p.elasticity);
  const dip = pull * lift;
  const margin = p.price - p.cost;
  const promoMargin = p.price * (1 - depth) - p.cost;
  const weeks = Array.from({ length: 9 }, (_, i) => {
    if (i === 2) return p.base + lift;
    if (i > 2 && i <= 2 + dipWeeks) return p.base - dip / dipWeeks;
    return p.base;
  });
  const profit = (p.base + lift) * promoMargin - p.base * margin - dip * margin;
  return { lift, dip, net: lift - dip, profit, weeks, promoMargin };
}

export const PS = { skus: 200, weeks: 104, train: 78, promos: 10, gap: 6, depths: [0.1, 0.15, 0.2, 0.25, 0.3], seed: 4 };
export type PromoModel = "history" | "depth" | "dip";
export const PROMO_MODELS: PromoModel[] = ["history", "depth", "dip"];

export type PromoSku = { base: number; depth: number[]; y: number[] };

/** One SKU: a base rate, ten promos at least six weeks apart, a lift and a dip after each. */
export function promoSku(rng: Rng): PromoSku {
  const base = 100 * Math.exp(0.5 * normal(rng));
  const depth = new Array<number>(PS.weeks).fill(0);
  const weeks: number[] = [];
  while (weeks.length < PS.promos) {
    const w = 3 + Math.floor(rng() * (PS.weeks - 3));
    if (weeks.every((v) => Math.abs(v - w) >= PS.gap)) weeks.push(w);
  }
  for (const w of weeks) depth[w] = PS.depths[Math.floor(rng() * PS.depths.length)];
  const expected = new Array<number>(PS.weeks).fill(base);
  for (const w of weeks) {
    const lift = promoLift(depth[w], base);
    expected[w] += lift;
    for (let k = 1; k <= PROMO.dipWeeks && w + k < PS.weeks; k++) expected[w + k] -= (PROMO.pull * lift) / PROMO.dipWeeks;
  }
  return { base, depth, y: expected.map((m) => poisson(rng, m)) };
}

function promoFeatures(d: number[], t: number, model: PromoModel): number[] {
  if (model === "history") return [1];
  if (model === "depth") return [1, d[t], d[t] ** 2];
  return [1, d[t], d[t] ** 2, d[t - 1] ?? 0, d[t - 2] ?? 0, d[t - 3] ?? 0];
}

/** Least squares with a whisper of ridge so a SKU with few promos still solves. */
export function leastSquares(X: number[][], y: number[], ridge = 1e-6): number[] {
  const p = X[0].length;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? ridge : 0)));
  const b = Array.from({ length: p }, (_, i) => X.reduce((s, r, n) => s + r[i] * y[n], 0));
  return solve(A, b);
}

/** Fit on the training weeks, then forecast the test weeks with the promo calendar known in advance. */
export function promoForecast(sku: PromoSku, model: PromoModel): number[] {
  const X: number[][] = [];
  const y: number[] = [];
  for (let t = 3; t < PS.train; t++) {
    X.push(promoFeatures(sku.depth, t, model));
    y.push(sku.y[t]);
  }
  const beta = leastSquares(X, y);
  return Array.from({ length: PS.weeks - PS.train }, (_, i) => promoFeatures(sku.depth, PS.train + i, model).reduce((s, v, j) => s + v * beta[j], 0));
}

export function promoSkus(seed = PS.seed, n = PS.skus): PromoSku[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => promoSku(rng));
}

/**
 * Score each model on the test weeks: WAPE on promo weeks, bias on the three weeks after a promo
 * (positive = over-forecast), and bias on ordinary weeks.
 */
export function promoStudy(seed = PS.seed, n = PS.skus) {
  const skus = promoSkus(seed, n);
  return PROMO_MODELS.map((model) => {
    let promoAbs = 0, promoY = 0, postErr = 0, postY = 0, plainErr = 0, plainY = 0;
    for (const s of skus) {
      const f = promoForecast(s, model);
      f.forEach((v, i) => {
        const t = PS.train + i;
        const y = s.y[t];
        const after = [1, 2, 3].some((k) => (s.depth[t - k] ?? 0) > 0);
        if (s.depth[t] > 0) {
          promoAbs += Math.abs(v - y);
          promoY += y;
        } else if (after) {
          postErr += v - y;
          postY += y;
        } else {
          plainErr += v - y;
          plainY += y;
        }
      });
    }
    return { model, promoWape: promoAbs / promoY, postBias: postErr / postY, plainBias: plainErr / plainY };
  });
}

// ---------- fc-deep: global models, scaling and sample paths ----------

export const GL = { train: 200, length: 60, phi: 0.6, unlikePhi: 0.95, marginalSd: 0.2, test: 300, horizon: 13, histories: [8, 13, 26, 52], seed: 21 };
export type Regime = "like" | "unlike";

/** A store-SKU: its own level (from 3 to 500 a week), wiggling around it with AR(1) memory φ. */
export function arSeries(rng: Rng, n: number, phi: number): { level: number; y: number[] } {
  const level = Math.exp(Math.log(40) + normal(rng));
  const innov = GL.marginalSd * Math.sqrt(1 - phi * phi);
  let u = normal(rng) * GL.marginalSd;
  const y: number[] = [];
  for (let t = 0; t < n; t++) {
    y.push(Math.max(0, level * (1 + u)));
    u = phi * u + normal(rng) * innov;
  }
  return { level, y };
}

/** Mean scaling, as DeepAR and Chronos do: divide a window by its average. */
export const meanScale = (y: number[]) => {
  const s = mean(y);
  return { scale: s, scaled: y.map((v) => v / s) };
};

/** Rows [1, y(t)/s, y(t−1)/s] → target y(t+1)/s, from one series. */
function arRows(y: number[], s: number, X: number[][], t: number[]) {
  for (let i = 1; i < y.length - 1; i++) {
    X.push([1, y[i] / s, y[i - 1] / s]);
    t.push(y[i + 1] / s);
  }
}

/** The global model: one set of AR coefficients fitted to every training series, each scaled by its mean. */
export function fitGlobal(seed = GL.seed) {
  const rng = mulberry32(seed);
  const X: number[][] = [];
  const t: number[] = [];
  for (let i = 0; i < GL.train; i++) {
    const { y } = arSeries(rng, GL.length, GL.phi);
    arRows(y, mean(y), X, t);
  }
  const coef = leastSquares(X, t);
  const resid = X.map((r, i) => t[i] - (coef[0] + coef[1] * r[1] + coef[2] * r[2]));
  return { coef, sd: Math.sqrt(mean(resid.map((e) => e * e))), rows: X.length };
}

/**
 * Forecast a new series one week at a time for 13 weeks after `history` weeks, with the global
 * coefficients (zero-shot), coefficients fitted to its own history (local), or the history mean.
 * Returns mean absolute error as a share of the series' true level.
 */
export function globalVsLocal(regime: Regime, history: number, seed = GL.seed + 1) {
  const g = fitGlobal().coef;
  const rng = mulberry32(seed + (regime === "like" ? 0 : 1000));
  const err = { global: 0, local: 0, mean: 0 };
  for (let i = 0; i < GL.test; i++) {
    const { level, y } = arSeries(rng, history + GL.horizon, regime === "like" ? GL.phi : GL.unlikePhi);
    const hist = y.slice(0, history);
    const s = mean(hist);
    const X: number[][] = [];
    const t: number[] = [];
    arRows(hist, s, X, t);
    const local = leastSquares(X, t, 1e-3);
    for (let h = history; h < history + GL.horizon; h++) {
      const a = y[h - 1] / s;
      const b = y[h - 2] / s;
      err.global += Math.abs(s * (g[0] + g[1] * a + g[2] * b) - y[h]) / level;
      err.local += Math.abs(s * (local[0] + local[1] * a + local[2] * b) - y[h]) / level;
      err.mean += Math.abs(s - y[h]) / level;
    }
  }
  const n = GL.test * GL.horizon;
  return { global: err.global / n, local: err.local / n, mean: err.mean / n };
}

/**
 * DeepAR-style ancestral sampling: draw next week from the model, feed the draw back in, repeat.
 * Starts from the last two scaled values and returns paths in units (× scale).
 */
export function samplePaths(coef: number[], sd: number, last: [number, number], scale: number, horizon: number, n: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => {
    let [b, a] = last;
    const path: number[] = [];
    for (let h = 0; h < horizon; h++) {
      const next = Math.max(0, coef[0] + coef[1] * a + coef[2] * b + sd * normal(rng));
      path.push(next * scale);
      b = a;
      a = next;
    }
    return path;
  });
}

export const DP = { last: [1.3, 1.25] as [number, number], scale: 40, horizon: 8, paths: 4000, seed: 13, q: 0.9 };

/**
 * The P90 of total demand over the first L weeks three ways: from the paths (right), by adding each
 * week's own P90 (what you get from per-horizon quantile outputs), and by assuming weeks independent.
 */
export function leadTimeP90(paths: number[][], L: number, q = DP.q) {
  const sums = paths.map((p) => p.slice(0, L).reduce((s, v) => s + v, 0));
  let sumOfQ = 0;
  let mu = 0;
  let v = 0;
  for (let h = 0; h < L; h++) {
    const col = paths.map((p) => p[h]);
    const m = mean(col);
    sumOfQ += quantile(col, q);
    mu += m;
    v += mean(col.map((x) => (x - m) ** 2));
  }
  return { paths: quantile(sums, q), sumOfQ, indep: mu + normalQuantile(q) * Math.sqrt(v), mean: mean(sums) };
}

/** Chronos-style tokens: scale by the mean, then round to the nearest of evenly spaced bin centres. */
export function tokenize(y: number[], width: number) {
  const { scale, scaled } = meanScale(y);
  const tokens = scaled.map((v) => Math.round(v / width));
  const back = tokens.map((k) => k * width * scale);
  return { scale, scaled, tokens, back, maxErr: Math.max(...y.map((v, i) => Math.abs(v - back[i]))) };
}

// ---------- fc-safety-stock ----------

/** A Christmas wreath: one buy for the season, leftovers cleared at ₹20. */
export const NV_HAND = {
  price: 300,
  cost: 120,
  salvage: 20,
  demand: [
    [80, 0.1],
    [90, 0.2],
    [100, 0.4],
    [110, 0.2],
    [120, 0.1],
  ] as [number, number][],
};

/** Cu / (Cu + Co): the share of demand to cover, from the cost of being short and of being stuck. */
export const criticalRatio = (price: number, cost: number, salvage: number) => (price - cost) / (price - salvage);

/** Expected profit of ordering q against a discrete demand table. */
export function tableProfit(q: number, table: [number, number][], price: number, cost: number, salvage: number): number {
  return table.reduce((s, [d, p]) => s + p * (price * Math.min(d, q) + salvage * Math.max(q - d, 0)), 0) - cost * q;
}

/** pmf array long enough to hold all but 1e-10 of the mass. */
export function pmfArray(m: number, k: number | null): number[] {
  const out: number[] = [];
  let s = 0;
  for (let y = 0; s < 1 - 1e-10 && y < 100000; y++) {
    const p = k === null ? poissonPmf(y, m) : nbPmf(y, m, k);
    out.push(p);
    s += p;
  }
  return out;
}

/** Expected sales, leftovers and profit of ordering q against a pmf array. */
export function orderOutcome(q: number, pmf: number[], price: number, cost: number, salvage: number) {
  let sold = 0;
  let left = 0;
  let inStock = 0;
  pmf.forEach((p, y) => {
    sold += p * Math.min(y, q);
    left += p * Math.max(q - y, 0);
    if (y <= q) inStock += p;
  });
  return { sold, left, inStock, profit: price * sold + salvage * left - cost * q };
}

export function pmfQuantile(pmf: number[], p: number): number {
  let s = 0;
  for (let y = 0; y < pmf.length; y++) {
    s += pmf[y];
    if (s >= p - 1e-12) return y;
  }
  return pmf.length - 1;
}

export const NV = { mean: 100, k: 25, price: 300, cost: 120, salvage: 20 };

/** Weekly forecast errors with sd σ and correlation ρ^|i−j| between weeks i and j: sd of their L-week sum. */
export function leadTimeSd(sigma: number, L: number, rho: number): number {
  let s = 0;
  for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) s += rho ** Math.abs(i - j);
  return sigma * Math.sqrt(s);
}

/** The service a z·σ·√L safety stock really delivers when the errors are correlated. */
export function ruleService(L: number, rho: number, target: number): number {
  return normalCdf((normalQuantile(target) * Math.sqrt(L)) / (leadTimeSd(1, L, rho)));
}

export const SS = { sigma: 10, forecast: 40, L: 4, rho: 0.5, target: 0.95 };

export const POL = { skus: 1000, seed: 17 };
export type Policy = "mean" | "p95" | "cr" | "crPoisson";
export const POLICIES: Policy[] = ["mean", "p95", "cr", "crPoisson"];

export type SeasonSku = { m: number; k: number; price: number; cost: number };

/** 1,000 seasonal SKUs: a few fast sellers, a long tail of slow ones, margins from 20% to 60%. */
export function seasonSkus(seed = POL.seed, n = POL.skus): SeasonSku[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const m = Math.exp(Math.log(8) + normal(rng));
    const k = 1 + Math.floor(rng() * 10);
    const price = 100 + 500 * rng();
    const cost = price * (0.4 + 0.4 * rng());
    return { m, k, price, cost };
  });
}

/** Order each SKU by one policy; leftovers are cleared at `salvageShare` of cost. Totals across SKUs. */
export function policyStudy(salvageShare: number, seed = POL.seed, n = POL.skus) {
  const skus = seasonSkus(seed, n);
  const pmfs = skus.map((s) => pmfArray(s.m, s.k));
  const demand = skus.reduce((s, x) => s + x.m, 0);
  return POLICIES.map((policy) => {
    let profit = 0, units = 0, sold = 0, left = 0, inStock = 0;
    skus.forEach((s, i) => {
      const salvage = s.cost * salvageShare;
      const cr = criticalRatio(s.price, s.cost, salvage);
      const q =
        policy === "mean" ? Math.round(s.m)
        : policy === "p95" ? pmfQuantile(pmfs[i], 0.95)
        : policy === "cr" ? pmfQuantile(pmfs[i], cr)
        : poissonQuantile(cr, s.m);
      const o = orderOutcome(q, pmfs[i], s.price, s.cost, salvage);
      profit += o.profit;
      units += q;
      sold += o.sold;
      left += o.left;
      inStock += o.inStock;
    });
    return { policy, profit, units, fill: sold / demand, left, inStock: inStock / n };
  });
}

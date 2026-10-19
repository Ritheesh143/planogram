// Shrinkage, Bayesian regression and partial pooling: the numbers behind Bayes rungs 7–9.

import { normalNormal } from "./bayes";
import { mulberry32, normal, type Rng } from "./rng";

// ---------- Rung 7 and 9: a chain of stores with planted true means ----------

/** Weeks of history for 40 stores: many new stores with a week or two, some with a full year. */
export const STORE_WEEKS = [
  1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 20, 20, 24, 24, 30, 30, 40, 40, 52, 52, 52, 52, 52, 52,
];

export type Chain = {
  /** True mean weekly sales of each store (never seen by the analyst). */
  theta: number[];
  n: number[];
  /** Each store's observed average over its n weeks. */
  ybar: number[];
};

/** Store means θ ~ N(mu, tau²); each week's sales ~ N(θ, sigma²). */
export function chainWorld(rng: Rng, mu = 50, tau = 10, sigma = 20, weeks = STORE_WEEKS): Chain {
  const theta = weeks.map(() => normal(rng, mu, tau));
  const ybar = theta.map((t, j) => {
    let s = 0;
    for (let w = 0; w < weeks[j]; w++) s += normal(rng, t, sigma);
    return s / weeks[j];
  });
  return { theta, n: [...weeks], ybar };
}

export const sse = (est: number[], truth: number[]) => est.reduce((s, v, i) => s + (v - truth[i]) ** 2, 0);
export const mse = (est: number[], truth: number[]) => sse(est, truth) / truth.length;

/** Shrink every store toward a known chain mean m0 with known store spread v0 (rung 7). */
export function shrinkAll(c: Chain, m0: number, v0: number, sigma2: number): number[] {
  return c.ybar.map((y, j) => normalNormal(m0, v0, y, sigma2, c.n[j]).mean);
}

export type Pooled = {
  none: number[];
  complete: number[];
  partial: number[];
  mu: number;
  tau2: number;
  weights: number[];
};

/**
 * No pooling (each store's own mean), complete pooling (one mean for all), and partial pooling with
 * μ and τ² estimated from the stores themselves (empirical Bayes, method of moments). σ² is known.
 */
export function pool(c: Chain, sigma2: number): Pooled {
  const J = c.ybar.length;
  const totalWeeks = c.n.reduce((s, v) => s + v, 0);
  const grand = c.ybar.reduce((s, y, j) => s + y * c.n[j], 0) / totalWeeks;
  // Method of moments: the spread of store averages = true spread + sampling noise.
  const meanY = c.ybar.reduce((s, v) => s + v, 0) / J;
  const spread = c.ybar.reduce((s, v) => s + (v - meanY) ** 2, 0) / (J - 1);
  const noise = c.n.reduce((s, n) => s + sigma2 / n, 0) / J;
  const tau2 = Math.max(spread - noise, 0);
  // Precision-weighted chain mean under that τ².
  const prec = c.n.map((n) => 1 / (tau2 + sigma2 / n));
  const mu = c.ybar.reduce((s, y, j) => s + y * prec[j], 0) / prec.reduce((s, v) => s + v, 0);
  const weights = c.n.map((n) => (tau2 === 0 ? 0 : tau2 / (tau2 + sigma2 / n)));
  return {
    none: [...c.ybar],
    complete: c.ybar.map(() => grand),
    partial: c.ybar.map((y, j) => weights[j] * y + (1 - weights[j]) * mu),
    mu,
    tau2,
    weights,
  };
}

/** Log marginal likelihood of τ given store averages: ȳ_j ~ N(μ, τ² + σ²/n_j), μ set to its best value. */
export function tauLogLik(c: Chain, sigma2: number, tau: number): number {
  const v = c.n.map((n) => tau * tau + sigma2 / n);
  const mu = c.ybar.reduce((s, y, j) => s + y / v[j], 0) / v.reduce((s, x) => s + 1 / x, 0);
  return c.ybar.reduce((s, y, j) => s - 0.5 * Math.log(2 * Math.PI * v[j]) - ((y - mu) ** 2) / (2 * v[j]), 0);
}

// ---------- Rung 8: Bayesian regression on the five paint weeks ----------

export const BL_SIGMA2 = 4;

/** Posterior for the slope with centered prices: precision Sxx/σ² + 1/τ², mean (Sxy/σ²)/precision. */
export function slopePosterior(x: number[], y: number[], sigma2: number, tau2: number): { mean: number; sd: number; lambda: number } {
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  let sxx = 0;
  let sxy = 0;
  x.forEach((xi, i) => {
    sxx += (xi - mx) ** 2;
    sxy += (xi - mx) * (y[i] - my);
  });
  const prec = sxx / sigma2 + (Number.isFinite(tau2) ? 1 / tau2 : 0);
  return { mean: sxy / sigma2 / prec, sd: Math.sqrt(1 / prec), lambda: Number.isFinite(tau2) ? sigma2 / tau2 : 0 };
}

export type CoverageMode = "matched" | "wrong" | "flat";

export type SlopeInterval = { truth: number; lo: number; hi: number; covers: boolean };

/**
 * Repeat the five-week world many times and record the 90% credible interval for the slope.
 * "matched": true slopes drawn from the prior N(0, 0.4). "wrong": the true slope is −8 but the
 * prior is still N(0, 0.4). "flat": true slope −8 and no prior.
 */
export function slopeIntervals(mode: CoverageMode, worlds: number, seed: number): SlopeInterval[] {
  const rng = mulberry32(seed);
  const x = [4, 5, 6, 7, 8];
  const tau2 = mode === "flat" ? Infinity : 0.4;
  const out: SlopeInterval[] = [];
  for (let k = 0; k < worlds; k++) {
    const b = mode === "matched" ? normal(rng, 0, Math.sqrt(0.4)) : -8;
    const y = x.map((xi) => 52 + b * (xi - 6) + normal(rng, 0, 2));
    const post = slopePosterior(x, y, BL_SIGMA2, tau2);
    const lo = post.mean - 1.6449 * post.sd;
    const hi = post.mean + 1.6449 * post.sd;
    out.push({ truth: b, lo, hi, covers: b >= lo && b <= hi });
  }
  return out;
}

export function slopeCoverage(mode: CoverageMode, worlds: number, seed: number): number {
  return slopeIntervals(mode, worlds, seed).filter((i) => i.covers).length / worlds;
}

/** Average error of the three pooling choices over many simulated chains with true store spread tau. */
export function poolingStudy(tau: number, chains: number, seed: number): { none: number; complete: number; partial: number } {
  const rng = mulberry32(seed);
  const acc = { none: 0, complete: 0, partial: 0 };
  for (let k = 0; k < chains; k++) {
    const c = chainWorld(rng, 50, tau, 20);
    const p = pool(c, 400);
    acc.none += mse(p.none, c.theta) / chains;
    acc.complete += mse(p.complete, c.theta) / chains;
    acc.partial += mse(p.partial, c.theta) / chains;
  }
  return acc;
}

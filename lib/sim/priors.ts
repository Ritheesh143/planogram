// Helpers for rungs 5 and 6: the gamma-Poisson world, prior predictive checks for a log-normal
// prior on a store's daily sales rate, and how fast a prior washes out.

import { gammaP, gammaPoissonUpdate } from "./bayes";
import { normalQuantile } from "./prob";
import { gamma, mulberry32, normal, poisson } from "./rng";

/** Standard normal CDF: Φ(z) = ½(1 + erf(z/√2)), with erf(x) = P(½, x²) from the incomplete gamma function. */
export function normalCdf(z: number): number {
  const erf = gammaP(0.5, (z * z) / 2); // erf(z/√2)
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** The p-quantile of λ when log λ ~ Normal(m, s). */
export function lognormalQuantile(m: number, s: number, p: number): number {
  return Math.exp(m + s * normalQuantile(p));
}

/** Share of stores whose average daily sales exceed `threshold` when log λ ~ Normal(m, s). */
export function shareAbove(m: number, s: number, threshold: number): number {
  return 1 - normalCdf((Math.log(threshold) - m) / s);
}

export type PoolResult = { counts: number[]; mean: number; variance: number; ratio: number };

/**
 * 40 stores whose true daily rates are drawn from Gamma(k, k/mean), each selling Poisson(rate)
 * for `days` days. Pooled daily sales: smaller k (more different stores) means more dispersion.
 * k = Infinity gives every store the same rate.
 */
export function poolStores(k: number, seed = 5, stores = 40, days = 90, mean = 2): PoolResult {
  const rng = mulberry32(seed);
  const all: number[] = [];
  for (let s = 0; s < stores; s++) {
    const rate = Number.isFinite(k) ? gamma(rng, k, mean / k) : mean;
    for (let d = 0; d < days; d++) all.push(poisson(rng, rate));
  }
  const m = all.reduce((a, b) => a + b, 0) / all.length;
  const v = all.reduce((a, b) => a + (b - m) ** 2, 0) / (all.length - 1);
  const counts = Array.from({ length: 13 }, (_, i) => all.filter((x) => (i === 12 ? x >= 12 : x === i)).length);
  return { counts, mean: m, variance: v, ratio: v / m };
}

export type GammaPrior = { name: string; shape: number; rate: number };

/** Posterior mean of a Poisson rate after each day of the same sales record, for each prior. */
export function washOut(priors: GammaPrior[], sales: number[]): number[][] {
  return priors.map((p) => {
    const out = [p.shape / p.rate];
    let sum = 0;
    sales.forEach((k, i) => {
      sum += k;
      const [a, b] = gammaPoissonUpdate(p.shape, p.rate, sum, i + 1);
      out.push(a / b);
    });
    return out;
  });
}

/** A seeded sales record for one store with a known rate. */
export function salesRecord(rate: number, days: number, seed = 21): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: days }, () => poisson(rng, rate));
}

export type WorldScore = { mle: number; defensible: number; wrong: number };

/**
 * Repeat the world: new stores whose rates come from the chain (log λ ~ Normal(log 2, 0.5)),
 * observed for `days` days. Root-mean-squared error of three estimates of each store's rate.
 */
export function repeatWorld(days: number, defensible: GammaPrior, wrong: GammaPrior, stores = 2000, seed = 33): WorldScore {
  const rng = mulberry32(seed);
  let mle = 0;
  let good = 0;
  let bad = 0;
  for (let s = 0; s < stores; s++) {
    const rate = Math.exp(normal(rng, Math.log(2), 0.5));
    let sum = 0;
    for (let d = 0; d < days; d++) sum += poisson(rng, rate);
    mle += (sum / days - rate) ** 2;
    good += ((defensible.shape + sum) / (defensible.rate + days) - rate) ** 2;
    bad += ((wrong.shape + sum) / (wrong.rate + days) - rate) ** 2;
  }
  return { mle: Math.sqrt(mle / stores), defensible: Math.sqrt(good / stores), wrong: Math.sqrt(bad / stores) };
}

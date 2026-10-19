// Simulations for Bayes rungs 3 and 4: grid posteriors for a Poisson rate, "repeat the world"
// calibration checks, and many endcaps with a Beta prior.

import { betaInterval, gammaPdf, normalize } from "./bayes";
import { logFactorial } from "./prob";
import { binomial, gamma, mulberry32, poisson, type Rng } from "./rng";

/** Log-likelihood of Poisson counts at rate λ (log scale, so long data never underflows). */
export function poissonLogLik(data: number[], lambda: number): number {
  return data.reduce((s, k) => s + k * Math.log(lambda) - lambda - logFactorial(k), 0);
}

/** Posterior over a grid of rates: prior weights × likelihood, normalized. Works on the log scale. */
export function poissonGridPosterior(lambdas: number[], prior: number[], data: number[]): number[] {
  const logs = lambdas.map((l, i) => (prior[i] > 0 ? Math.log(prior[i]) + poissonLogLik(data, l) : -Infinity));
  const top = Math.max(...logs);
  return normalize(logs.map((v) => Math.exp(v - top)));
}

/** Relative likelihood (largest bar = 1) for drawing. */
export function relativeLikelihood(lambdas: number[], data: number[]): number[] {
  const logs = lambdas.map((l) => poissonLogLik(data, l));
  const top = Math.max(...logs);
  return logs.map((v) => Math.exp(v - top));
}

export function gridMean(xs: number[], w: number[]): number {
  return xs.reduce((s, x, i) => s + x * w[i], 0);
}

/** Central interval on a grid: the first points where the running total reaches (1−level)/2 and (1+level)/2. */
export function gridInterval(xs: number[], w: number[], level = 0.9): [number, number] {
  const lo = (1 - level) / 2;
  const hi = 1 - lo;
  let cum = 0;
  let a = xs[0];
  let b = xs[xs.length - 1];
  let foundA = false;
  for (let i = 0; i < xs.length; i++) {
    cum += w[i];
    if (!foundA && cum >= lo - 1e-12) {
      a = xs[i];
      foundA = true;
    }
    if (cum >= hi - 1e-12) {
      b = xs[i];
      break;
    }
  }
  return [a, b];
}

// The finer grid used by the visual: λ from 0.1 to 6 in steps of 0.1.
export const PG_GRID = Array.from({ length: 60 }, (_, i) => Math.round((i + 1) * 10) / 100);

export type PriorPreset = "flat" | "hunch" | "skeptical";

/** Prior presets on the visual's grid: flat; a manager's hunch near 3; a skeptic's belief near 1. */
export function presetPrior(preset: PriorPreset, xs: number[] = PG_GRID): number[] {
  if (preset === "flat") return normalize(xs.map(() => 1));
  if (preset === "hunch") return normalize(xs.map((x) => gammaPdf(x, 9, 3)));
  return normalize(xs.map((x) => gammaPdf(x, 8, 8)));
}

/** Keystone 3's three days, then extra days simulated at a true rate of 1.2 (seeded, so always the same). */
export const PG_DAYS = [0, 2, 1];
export const PG_EXTRA = (() => {
  const rng = mulberry32(2024);
  return Array.from({ length: 27 }, () => poisson(rng, 1.2));
})();

export function pgData(extraDays: number): number[] {
  return [...PG_DAYS, ...PG_EXTRA.slice(0, extraDays)];
}

export type WorldResult = { truth: number; lo: number; hi: number; covers: boolean };

/**
 * Repeat the world: draw a true rate from the chain's real spread of rates (Gamma(3, rate 2)),
 * simulate `days` of sales, and build a 90% credible interval with the analyst's prior.
 */
export function repeatWorlds(n: number, analystPrior: "matched" | "wrong" | "flat", days = 3, seed = 5): WorldResult[] {
  const rng: Rng = mulberry32(seed);
  const xs = Array.from({ length: 400 }, (_, i) => (i + 1) * 0.02);
  const prior =
    analystPrior === "matched"
      ? normalize(xs.map((x) => gammaPdf(x, 3, 2)))
      : analystPrior === "wrong"
        ? normalize(xs.map((x) => gammaPdf(x, 40, 10)))
        : normalize(xs.map(() => 1));
  const out: WorldResult[] = [];
  for (let w = 0; w < n; w++) {
    const truth = gamma(rng, 3, 0.5);
    const data = Array.from({ length: days }, () => poisson(rng, truth));
    const post = poissonGridPosterior(xs, prior, data);
    const [lo, hi] = gridInterval(xs, post, 0.9);
    out.push({ truth, lo, hi, covers: truth >= lo - 0.01 && truth <= hi + 0.01 });
  }
  return out;
}

// ---------- Rung 4: Beta–Binomial ----------

/** The ten endcap visitors from the floor problem: 3 bought (1), 7 didn't (0). */
export const BB_VISITORS = [0, 1, 0, 0, 0, 1, 0, 0, 1, 0];

export function betaSample(rng: Rng, a: number, b: number): number {
  const x = gamma(rng, a, 1);
  const y = gamma(rng, b, 1);
  return x / (x + y);
}

export type EndcapStats = { rawError: number; postError: number; coverage: number; sample: { truth: number; raw: number; post: number }[] };

/** Many endcaps with true rates from the Beta(a, b) prior and `visitors` shoppers each. */
export function simulateEndcaps(n: number, a: number, b: number, visitors: number, seed = 9): EndcapStats {
  const rng = mulberry32(seed);
  let rawErr = 0;
  let postErr = 0;
  let cover = 0;
  const sample: EndcapStats["sample"] = [];
  // Every endcap with the same k shares the same interval, so compute each one once.
  const intervals = Array.from({ length: visitors + 1 }, (_, k) => betaInterval(a + k, b + visitors - k, 0.9));
  for (let i = 0; i < n; i++) {
    const truth = betaSample(rng, a, b);
    const k = binomial(rng, visitors, truth);
    const raw = k / visitors;
    const post = (a + k) / (a + b + visitors);
    rawErr += Math.abs(raw - truth);
    postErr += Math.abs(post - truth);
    const [lo, hi] = intervals[k];
    if (truth >= lo && truth <= hi) cover++;
    if (sample.length < 200) sample.push({ truth, raw, post });
  }
  return { rawError: rawErr / n, postError: postErr / n, coverage: cover / n, sample };
}

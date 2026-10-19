// Each common loss is the negative log-likelihood of a noise model. These functions compute
// the NLL of a constant prediction μ for some data, so lessons can show where each one bottoms out.

import { logFactorial } from "./prob";

export type NoiseModel = "gaussian" | "laplace" | "poisson";

/** Gaussian noise with scale σ: NLL = n·½log(2πσ²) + Σ(y − μ)² / (2σ²). */
export function gaussianNLL(y: number[], mu: number, sigma = 1): number {
  return y.reduce((s, v) => s + 0.5 * Math.log(2 * Math.PI * sigma * sigma) + (v - mu) ** 2 / (2 * sigma * sigma), 0);
}

/** Laplace noise with scale b: NLL = n·log(2b) + Σ|y − μ| / b. */
export function laplaceNLL(y: number[], mu: number, b = 1): number {
  return y.reduce((s, v) => s + Math.log(2 * b) + Math.abs(v - mu) / b, 0);
}

/** Poisson counts with rate λ: NLL = Σ [λ − y·log λ + log y!]. */
export function poissonNLL(y: number[], lambda: number): number {
  return y.reduce((s, v) => s + lambda - v * Math.log(lambda) + logFactorial(v), 0);
}

/** Bernoulli outcomes with probability p: NLL = −Σ [y log p + (1 − y) log(1 − p)], the log loss. */
export function bernoulliNLL(y: number[], p: number): number {
  return -y.reduce((s, v) => s + (v ? Math.log(p) : Math.log(1 - p)), 0);
}

/** Pinball (quantile) loss at level τ: under-predictions cost τ per unit, over-predictions 1 − τ. */
export function pinball(y: number[], q: number, tau: number): number {
  return y.reduce((s, v) => s + (v >= q ? tau * (v - q) : (1 - tau) * (q - v)), 0);
}

export function nll(model: NoiseModel, y: number[], mu: number, scale = 1): number {
  if (model === "gaussian") return gaussianNLL(y, mu, scale);
  if (model === "laplace") return laplaceNLL(y, mu, scale);
  return poissonNLL(y, mu);
}

/** Smallest value on a grid minimizing f, for checking closed forms numerically. */
export function argminGrid(f: (x: number) => number, lo: number, hi: number, steps = 4000): number {
  let best = lo;
  let bestV = Infinity;
  for (let i = 0; i <= steps; i++) {
    const x = lo + ((hi - lo) * i) / steps;
    const v = f(x);
    if (v < bestV - 1e-12) {
      bestV = v;
      best = x;
    }
  }
  return best;
}

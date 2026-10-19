// The Bayesian toolkit for the ladder: densities, conjugate updates, grid posteriors and
// credible intervals. Everything is computed with sums over thin bars or closed forms you can check.

/** log Γ(x) by the Lanczos approximation (accurate to ~1e-13 for x > 0). */
export function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

export function betaPdf(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) {
    if ((x === 0 && a < 1) || (x === 1 && b < 1)) return Infinity;
    if ((x === 0 && a === 1) || (x === 1 && b === 1)) return Math.exp(-logBeta(a, b));
    return 0;
  }
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b));
}

/** Gamma density with shape α and rate β (mean α/β). */
export function gammaPdf(x: number, shape: number, rate: number): number {
  if (x <= 0) return 0;
  return Math.exp(shape * Math.log(rate) - logGamma(shape) + (shape - 1) * Math.log(x) - rate * x);
}

export function normalPdf(x: number, mean: number, sd: number): number {
  return Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
}

/** Binomial probability of k successes in n tries. */
export function binomialPmf(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/**
 * Negative binomial: the number of units sold when the rate is Gamma(r, rate β) and sales are Poisson.
 * P(k) = Γ(k + r) / (k! Γ(r)) · (β/(β+1))^r · (1/(β+1))^k. Mean r/β, variance r/β · (1 + 1/β).
 */
export function negBinomialPmf(k: number, r: number, beta: number): number {
  const p = beta / (beta + 1);
  return Math.exp(logGamma(k + r) - logGamma(k + 1) - logGamma(r) + r * Math.log(p) + k * Math.log(1 - p));
}

/** Multiply prior bars by likelihood bars and divide by the total: Bayes on a grid. */
export function gridPosterior(prior: number[], likelihood: number[]): number[] {
  const unnorm = prior.map((p, i) => p * likelihood[i]);
  const total = unnorm.reduce((s, v) => s + v, 0);
  return unnorm.map((v) => v / total);
}

export function normalize(weights: number[]): number[] {
  const t = weights.reduce((s, v) => s + v, 0);
  return weights.map((w) => w / t);
}

/** Beta(a, b) prior + k successes in n tries → Beta(a + k, b + n − k). */
export function betaBinomialUpdate(a: number, b: number, k: number, n: number): [number, number] {
  return [a + k, b + n - k];
}

/** Gamma(α, β) prior on a Poisson rate + counts summing to S over n days → Gamma(α + S, β + n). */
export function gammaPoissonUpdate(shape: number, rate: number, sum: number, n: number): [number, number] {
  return [shape + sum, rate + n];
}

export type NormalPosterior = { mean: number; variance: number; weightOnData: number };

/**
 * Normal prior (mean m0, variance v0) and a data mean ȳ with sampling variance s²/n.
 * Precisions add, and the posterior mean is the precision-weighted average.
 */
export function normalNormal(m0: number, v0: number, ybar: number, sampleVar: number, n: number): NormalPosterior {
  const pPrior = 1 / v0;
  const pData = n / sampleVar;
  const variance = 1 / (pPrior + pData);
  const weightOnData = pData / (pPrior + pData);
  return { mean: weightOnData * ybar + (1 - weightOnData) * m0, variance, weightOnData };
}

/** Continued fraction for the regularized incomplete beta function (Numerical Recipes' betacf). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 1e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** P(X ≤ x) for X ~ Beta(a, b). */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Regularized lower incomplete gamma P(s, x): the Gamma(s, rate 1) CDF at x. */
export function gammaP(s: number, x: number): number {
  if (x <= 0) return 0;
  if (x < s + 1) {
    let sum = 1 / s;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
  }
  // Continued fraction for the upper tail (Lentz).
  let b = x + 1 - s;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

export function gammaCdf(x: number, shape: number, rate: number): number {
  return gammaP(shape, rate * x);
}

/** Invert a CDF by bisection on [lo, hi]. */
export function invert(cdf: (x: number) => number, p: number, lo: number, hi: number): number {
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Central credible interval of Beta(a, b), e.g. level 0.9 gives the 5th and 95th percentiles. */
export function betaInterval(a: number, b: number, level = 0.9): [number, number] {
  const t = (1 - level) / 2;
  return [invert((x) => betaCdf(x, a, b), t, 0, 1), invert((x) => betaCdf(x, a, b), 1 - t, 0, 1)];
}

export function gammaInterval(shape: number, rate: number, level = 0.9): [number, number] {
  const t = (1 - level) / 2;
  const hi = (shape / rate) * 20 + 20 / rate;
  return [invert((x) => gammaCdf(x, shape, rate), t, 0, hi), invert((x) => gammaCdf(x, shape, rate), 1 - t, 0, hi)];
}

/** Evenly spaced grid points from lo to hi inclusive. */
export function grid(lo: number, hi: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}

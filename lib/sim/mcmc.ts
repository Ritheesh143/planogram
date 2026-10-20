// Sampling: the numbers behind Bayes rungs 10–13. A bag of posterior draws (rung 10), the Metropolis
// walker, HMC and the diagnostics (rung 11), Bayesian A/B testing by counting (rung 12) and a tiny
// two-channel media mix model fitted by MCMC (rung 13).

import { betaCdf, betaPdf, logGamma } from "./bayes";
import { gamma, mulberry32, normal, type Rng } from "./rng";

// ---------- Rung 10: why sample ----------

/** Points in a grid with `perAxis` values for each of `dims` unknowns. */
export const gridPoints = (dims: number, perAxis = 100) => perAxis ** dims;

/** Share of the cube [−1, 1]^d taken up by the ball of radius 1 inside it: π^(d/2) / (Γ(d/2 + 1) · 2^d). */
export function ballFraction(d: number): number {
  return Math.exp((d / 2) * Math.log(Math.PI) - logGamma(d / 2 + 1) - d * Math.log(2));
}

/** A Beta(a, b) draw as G(a) / (G(a) + G(b)). */
export function betaDraw(rng: Rng, a: number, b: number): number {
  const x = gamma(rng, a);
  return x / (x + gamma(rng, b));
}

/** The endcap posterior from rung 4: Beta(5, 15). */
export const EC_A = 5;
export const EC_B = 15;

/** A bag of n draws from Beta(a, b). */
export function bag(n: number, seed: number, a = EC_A, b = EC_B): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => betaDraw(rng, a, b));
}

export const share = (xs: number[], pred: (x: number) => boolean) => xs.filter(pred).length / xs.length;
export const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
export function sd(xs: number[]): number {
  const m = avg(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

/** The q-quantile of a sample (sorted copy, nearest rank with linear interpolation). */
export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = q * (s.length - 1);
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}

/**
 * Repeat the bag `reps` times at each size: how much does the estimate of P(rate > 0.3) wobble?
 * Returns the spread (sd) of the estimates for each bag size.
 */
export function bagStudy(sizes: number[], reps: number, seed: number): { n: number; spread: number; mean: number; est: number[] }[] {
  const rng = mulberry32(seed);
  return sizes.map((n) => {
    const est = Array.from({ length: reps }, () => {
      let k = 0;
      for (let i = 0; i < n; i++) if (betaDraw(rng, EC_A, EC_B) > 0.3) k++;
      return k / n;
    });
    return { n, spread: sd(est), mean: avg(est), est };
  });
}

// ---------- Rung 11: Metropolis, diagnostics, HMC ----------

/** Unnormalized log posterior of the endcap rate: log of θ⁴(1 − θ)¹⁴. */
export function logEndcap(t: number): number {
  return t <= 0 || t >= 1 ? -Infinity : (EC_A - 1) * Math.log(t) + (EC_B - 1) * Math.log(1 - t);
}

export type HandStep = { from: number; proposal: number; ratio: number; u: number; accept: boolean; to: number };

/** Metropolis with the proposals and coin flips written out, as in the by-hand table. */
export function handWalk(start: number, jumps: number[], us: number[], logp = logEndcap): HandStep[] {
  const out: HandStep[] = [];
  let t = start;
  jumps.forEach((j, i) => {
    const p = Math.round((t + j) * 1e9) / 1e9;
    const ratio = Math.exp(logp(p) - logp(t));
    const accept = us[i] < ratio;
    out.push({ from: t, proposal: p, ratio, u: us[i], accept, to: accept ? p : t });
    if (accept) t = p;
  });
  return out;
}

export type Chain1 = { draws: number[]; accepted: number };

/** Random-walk Metropolis in one dimension: propose θ + N(0, step²), accept with probability min(1, p(θ')/p(θ)). */
export function metropolis(logp: (t: number) => number, start: number, step: number, n: number, rng: Rng): Chain1 {
  const draws = new Array<number>(n);
  let t = start;
  let lp = logp(t);
  let accepted = 0;
  for (let i = 0; i < n; i++) {
    const p = t + normal(rng, 0, step);
    const lq = logp(p);
    if (Math.log(rng()) < lq - lp) {
      t = p;
      lp = lq;
      accepted++;
    }
    draws[i] = t;
  }
  return { draws, accepted };
}

/** Autocorrelation of a chain at lag k. */
export function autocorr(x: number[], k: number): number {
  const m = avg(x);
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    den += (x[i] - m) ** 2;
    if (i + k < x.length) num += (x[i] - m) * (x[i + k] - m);
  }
  return den === 0 ? 1 : num / den;
}

/**
 * Effective sample size of one chain: N / (1 + 2 Σ ρ_k), summing autocorrelations in pairs
 * (ρ_2m + ρ_2m+1) until a pair turns negative (Geyer's initial positive sequence).
 */
export function ess(x: number[]): number {
  const n = x.length;
  let s = 0;
  for (let m = 0; 2 * m + 1 < n; m++) {
    const pair = (m === 0 ? 1 : autocorr(x, 2 * m)) + autocorr(x, 2 * m + 1);
    if (pair <= 0) break;
    s += pair;
  }
  // τ = −1 + 2 Σ pairs (the m = 0 pair includes ρ_0 = 1).
  return n / Math.max(-1 + 2 * s, 1 / n);
}

/** Total effective sample size across chains. */
export const essChains = (chains: number[][]) => chains.reduce((s, c) => s + ess(c), 0);

/** Split R-hat: halve every chain, then compare the spread between halves with the spread within them. */
export function rhat(chains: number[][]): number {
  const halves = chains.flatMap((c) => {
    const h = Math.floor(c.length / 2);
    return [c.slice(0, h), c.slice(h, 2 * h)];
  });
  const n = halves[0].length;
  const means = halves.map(avg);
  const W = avg(halves.map((h) => sd(h) ** 2));
  const B = n * sd(means) ** 2;
  const varPlus = ((n - 1) / n) * W + B / n;
  return Math.sqrt(varPlus / W);
}

/** Four chains on the endcap posterior from spread-out starting points. */
export const DIAG_STARTS = [0.05, 0.35, 0.65, 0.95];

export type DiagScenario = "healthy" | "timid" | "short";
export const DIAG: Record<DiagScenario, { step: number; draws: number }> = {
  healthy: { step: 0.3, draws: 1000 },
  timid: { step: 0.003, draws: 1000 },
  short: { step: 0.1, draws: 40 },
};

export function diagChains(s: DiagScenario, seed = 11): number[][] {
  const rng = mulberry32(seed);
  return DIAG_STARTS.map((x0) => metropolis(logEndcap, x0, DIAG[s].step, DIAG[s].draws, rng).draws);
}

/** Acceptance rate and ESS per 4,000 draws for a range of step sizes, averaged over several chains. */
export function stepStudy(steps: number[], chains: number, draws: number, seed: number): { step: number; accept: number; ess: number; mean: number }[] {
  const rng = mulberry32(seed);
  return steps.map((step) => {
    let acc = 0;
    let e = 0;
    let m = 0;
    for (let c = 0; c < chains; c++) {
      const ch = metropolis(logEndcap, 0.25, step, draws, rng);
      acc += ch.accepted / draws / chains;
      e += ess(ch.draws) / chains;
      m += avg(ch.draws) / chains;
    }
    return { step, accept: acc, ess: e, mean: m };
  });
}

// HMC on a correlated two-dimensional Normal: two parameters the data can't separate well (like two
// collinear channels' ROIs, whose estimates are negatively correlated; the geometry is the same).

export const HMC_RHO = 0.95;

/** −log p and its gradient for a standard bivariate Normal with correlation ρ. */
export function bivariate(rho = HMC_RHO) {
  const k = 1 / (1 - rho * rho);
  return {
    U: (x: number, y: number) => 0.5 * k * (x * x - 2 * rho * x * y + y * y),
    grad: (x: number, y: number): [number, number] => [k * (x - rho * y), k * (y - rho * x)],
  };
}

export type Trajectory = { path: [number, number][]; energyError: number; divergent: boolean; accepted: boolean };

/** Stan flags a trajectory as divergent when the energy error passes 1,000. */
export const DIVERGENCE = 1000;

/**
 * One HMC iteration: flick the ball with a random momentum, roll it with `leaps` leapfrog steps of
 * size eps, then accept the end point with probability min(1, e^(−ΔH)).
 */
export function hmcStep(x0: [number, number], eps: number, leaps: number, rng: Rng, rho = HMC_RHO): Trajectory {
  const { U, grad } = bivariate(rho);
  let [x, y] = x0;
  let px = normal(rng);
  let py = normal(rng);
  const H0 = U(x, y) + 0.5 * (px * px + py * py);
  const path: [number, number][] = [[x, y]];
  let g = grad(x, y);
  let divergent = false;
  for (let i = 0; i < leaps; i++) {
    px -= 0.5 * eps * g[0];
    py -= 0.5 * eps * g[1];
    x += eps * px;
    y += eps * py;
    g = grad(x, y);
    px -= 0.5 * eps * g[0];
    py -= 0.5 * eps * g[1];
    path.push([x, y]);
    const err = U(x, y) + 0.5 * (px * px + py * py) - H0;
    if (!Number.isFinite(err) || err > DIVERGENCE) {
      divergent = true;
      break;
    }
  }
  const energyError = divergent ? Infinity : U(x, y) + 0.5 * (px * px + py * py) - H0;
  const accepted = !divergent && Math.log(rng()) < -energyError;
  return { path, energyError, divergent, accepted };
}

export type Run2 = { xs: number[]; ys: number[]; trajectories: Trajectory[]; accepted: number; divergences: number };

export function hmcRun(eps: number, leaps: number, iters: number, seed: number, rho = HMC_RHO): Run2 {
  const rng = mulberry32(seed);
  let cur: [number, number] = [1.5, 1.5];
  const xs: number[] = [];
  const ys: number[] = [];
  const trajectories: Trajectory[] = [];
  let accepted = 0;
  let divergences = 0;
  for (let i = 0; i < iters; i++) {
    const t = hmcStep(cur, eps, leaps, rng, rho);
    trajectories.push(t);
    if (t.divergent) divergences++;
    if (t.accepted) {
      cur = t.path[t.path.length - 1];
      accepted++;
    }
    xs.push(cur[0]);
    ys.push(cur[1]);
  }
  return { xs, ys, trajectories, accepted, divergences };
}

/** Average distance moved per iteration (rejections count as zero). */
export function avgJump(r: Run2): number {
  let s = 0;
  for (let i = 1; i < r.xs.length; i++) s += Math.hypot(r.xs[i] - r.xs[i - 1], r.ys[i] - r.ys[i - 1]);
  return s / (r.xs.length - 1);
}

/** Random-walk Metropolis on the same correlated Normal, for comparison. */
export function rwRun(step: number, iters: number, seed: number, rho = HMC_RHO): Run2 {
  const rng = mulberry32(seed);
  const { U } = bivariate(rho);
  let x = 1.5;
  let y = 1.5;
  const xs: number[] = [];
  const ys: number[] = [];
  let accepted = 0;
  for (let i = 0; i < iters; i++) {
    const nx = x + normal(rng, 0, step);
    const ny = y + normal(rng, 0, step);
    if (Math.log(rng()) < U(x, y) - U(nx, ny)) {
      x = nx;
      y = ny;
      accepted++;
    }
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys, trajectories: [], accepted, divergences: 0 };
}

/** Largest stable leapfrog step for this Normal: 2 / √(largest precision eigenvalue) = 2√(1 − ρ). */
export const leapfrogLimit = (rho = HMC_RHO) => 2 * Math.sqrt(1 - rho);

// ---------- Rung 12: Bayesian A/B testing ----------

/** The endcap test: the usual display (A) against the new one (B), with flat Beta(1, 1) priors. */
export const AB = { visitors: 1200, buysA: 48, buysB: 63 };

/** Draw n pairs from the two Beta posteriors. */
export function abDraws(buysA: number, buysB: number, visitors: number, n: number, seed: number): { a: number[]; b: number[] } {
  const rng = mulberry32(seed);
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    a.push(betaDraw(rng, 1 + buysA, 1 + visitors - buysA));
    b.push(betaDraw(rng, 1 + buysB, 1 + visitors - buysB));
  }
  return { a, b };
}

export type ABSummary = { pBetter: number; lossB: number; lossA: number; liftLo: number; liftMid: number; liftHi: number };

/** Everything by counting: P(B > A), the expected loss of each choice, and a 90% interval for B's relative lift. */
export function abSummary(a: number[], b: number[]): ABSummary {
  const n = a.length;
  let k = 0;
  let lossB = 0;
  let lossA = 0;
  const lift: number[] = [];
  for (let i = 0; i < n; i++) {
    if (b[i] > a[i]) k++;
    lossB += Math.max(a[i] - b[i], 0) / n;
    lossA += Math.max(b[i] - a[i], 0) / n;
    lift.push(b[i] / a[i] - 1);
  }
  return { pBetter: k / n, lossB, lossA, liftLo: quantile(lift, 0.05), liftMid: quantile(lift, 0.5), liftHi: quantile(lift, 0.95) };
}

/** P(B > A) for two Beta posteriors by thin bars: Σ density of B × chance A is below it × width. */
export function probBBeatsA(aA: number, bA: number, aB: number, bB: number, bars = 2000): number {
  const mean = (a: number, b: number) => a / (a + b);
  const spread = (a: number, b: number) => Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  const lo = Math.max(0, Math.min(mean(aA, bA) - 10 * spread(aA, bA), mean(aB, bB) - 10 * spread(aB, bB)));
  const hi = Math.min(1, Math.max(mean(aA, bA) + 10 * spread(aA, bA), mean(aB, bB) + 10 * spread(aB, bB)));
  const w = (hi - lo) / bars;
  let s = 0;
  for (let i = 0; i < bars; i++) {
    const x = lo + (i + 0.5) * w;
    s += betaPdf(x, aB, bB) * betaCdf(x, aA, bA) * w;
  }
  return s;
}

/** Fast P(B > A) from Normal approximations to the two Betas (used inside the peeking simulation). */
export function probBBeatsANormal(kA: number, kB: number, n: number): number {
  const m = (k: number) => (1 + k) / (2 + n);
  const v = (k: number) => (m(k) * (1 - m(k))) / (3 + n);
  const z = (m(kB) - m(kA)) / Math.sqrt(v(kA) + v(kB));
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Abramowitz–Stegun 7.1.26 (error below 1.5e-7). */
export function erf(x: number): number {
  const s = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}

/** Daily P(B > A) for a few A/A tests (both displays truly convert 4%), to watch it wander. */
export function peekPaths(tests: number, seed: number, rate = 0.04, days = 28, perDay = 100): number[][] {
  const rng = mulberry32(seed);
  return Array.from({ length: tests }, () => {
    let kA = 0;
    let kB = 0;
    const path: number[] = [];
    for (let d = 1; d <= days; d++) {
      for (let i = 0; i < perDay; i++) {
        if (rng() < rate) kA++;
        if (rng() < rate) kB++;
      }
      path.push(probBBeatsANormal(kA, kB, d * perDay));
    }
    return path;
  });
}

/**
 * A/A tests: both displays truly convert 4%. Each runs 28 days with 100 visitors per arm per day.
 * The analyst looks `looks` times (evenly spaced) and ships B the moment P(B > A) passes 95%.
 * Returns the share of tests that shipped a winner that doesn't exist.
 */
export function peekingStudy(looks: number, tests: number, seed: number, rate = 0.04, days = 28, perDay = 100): number {
  const rng = mulberry32(seed);
  const at = new Set(Array.from({ length: looks }, (_, i) => Math.round(((i + 1) * days) / looks)));
  let fooled = 0;
  for (let t = 0; t < tests; t++) {
    let kA = 0;
    let kB = 0;
    for (let d = 1; d <= days; d++) {
      for (let i = 0; i < perDay; i++) {
        if (rng() < rate) kA++;
        if (rng() < rate) kB++;
      }
      if (at.has(d)) {
        const p = probBBeatsANormal(kA, kB, d * perDay);
        if (p > 0.95) {
          fooled++;
          break;
        }
      }
    }
  }
  return fooled / tests;
}

// ---------- Rung 13: a two-channel media mix model ----------

export type MMMData = { tv: number[]; search: number[]; sales: number[] };

/** Planted truth: ₹ of extra sales per ₹ of spend. */
export const MMM_TRUTH = { base: 100, tv: 1.5, search: 2.5, sigma: 8 };

/**
 * 52 weeks for one region. Both channels follow the same seasonal plan (more spend around Diwali),
 * so TV and search spend move together and the data struggle to tell their effects apart.
 */
export function mmmWorld(seed: number, weeks = 52): MMMData {
  const rng = mulberry32(seed);
  const tv: number[] = [];
  const search: number[] = [];
  const sales: number[] = [];
  for (let w = 0; w < weeks; w++) {
    const season = Math.max(0, Math.cos((2 * Math.PI * (w - 43)) / 52));
    const t = 4 + 6 * season + normal(rng, 0, 0.6);
    const s = 2 + 3 * season + normal(rng, 0, 0.3);
    tv.push(t);
    search.push(s);
    sales.push(MMM_TRUTH.base + MMM_TRUTH.tv * t + MMM_TRUTH.search * s + normal(rng, 0, MMM_TRUTH.sigma));
  }
  return { tv, search, sales };
}

export const corr = (x: number[], y: number[]) => {
  const mx = avg(x);
  const my = avg(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  x.forEach((xi, i) => {
    sxy += (xi - mx) * (y[i] - my);
    sxx += (xi - mx) ** 2;
    syy += (y[i] - my) ** 2;
  });
  return sxy / Math.sqrt(sxx * syy);
};

/** Centered sums of squares: with the baseline's flat prior integrated out, these are all the likelihood needs. */
export function mmmStats(d: MMMData) {
  const mt = avg(d.tv);
  const ms = avg(d.search);
  const my = avg(d.sales);
  let tt = 0;
  let ss = 0;
  let ts = 0;
  let ty = 0;
  let sy = 0;
  d.tv.forEach((t, i) => {
    const a = t - mt;
    const b = d.search[i] - ms;
    const y = d.sales[i] - my;
    tt += a * a;
    ss += b * b;
    ts += a * b;
    ty += a * y;
    sy += b * y;
  });
  return { tt, ss, ts, ty, sy };
}

/** Least squares on the centered data: [β_tv, β_search] = (XᵀX)⁻¹ Xᵀy. */
export function mmmOLS(d: MMMData): [number, number] {
  const { tt, ss, ts, ty, sy } = mmmStats(d);
  const det = tt * ss - ts * ts;
  return [(ss * ty - ts * sy) / det, (tt * sy - ts * ty) / det];
}

export type MMMPrior = "flat" | "positive" | "lift";
/** The geo-lift test on TV: ROI 1.4 with a standard error of 0.3. */
export const LIFT = { mean: 1.4, sd: 0.3 };
/** Half-Normal(0, 3) on each ROI: positive, and below about 6 with high probability. */
export const HALF_SD = 3;

export function mmmLogPost(d: MMMData, prior: MMMPrior, sigma = MMM_TRUTH.sigma) {
  const { tt, ss, ts, ty, sy } = mmmStats(d);
  const s2 = sigma * sigma;
  return (bt: number, bs: number) => {
    // −SSE/(2σ²), dropping the parts that don't depend on the ROIs.
    let lp = -(bt * bt * tt + bs * bs * ss + 2 * bt * bs * ts - 2 * bt * ty - 2 * bs * sy) / (2 * s2);
    if (prior !== "flat") {
      if (bt < 0 || bs < 0) return -Infinity;
      lp -= (bt * bt + bs * bs) / (2 * HALF_SD * HALF_SD);
    }
    if (prior === "lift") lp -= ((bt - LIFT.mean) ** 2) / (2 * LIFT.sd * LIFT.sd);
    return lp;
  };
}

export type MMMFit = { chains: { tv: number[]; search: number[] }[]; tv: number[]; search: number[]; accept: number };

/** Four Metropolis chains on (β_tv, β_search), each warmed up and then kept. */
export function mmmSample(d: MMMData, prior: MMMPrior, seed: number, draws = 5000, warmup = 1000, step = 1): MMMFit {
  const rng = mulberry32(seed);
  const lp = mmmLogPost(d, prior);
  const starts: [number, number][] = [
    [0.5, 0.5],
    [4, 0.5],
    [0.5, 4],
    [3, 3],
  ];
  let acc = 0;
  const chains = starts.map(([t0, s0]) => {
    let bt = t0;
    let bs = s0;
    let cur = lp(bt, bs);
    const tv: number[] = [];
    const search: number[] = [];
    for (let i = 0; i < warmup + draws; i++) {
      const nt = bt + normal(rng, 0, step);
      const ns = bs + normal(rng, 0, step);
      const next = lp(nt, ns);
      if (Math.log(rng()) < next - cur) {
        bt = nt;
        bs = ns;
        cur = next;
        if (i >= warmup) acc++;
      }
      if (i >= warmup) {
        tv.push(bt);
        search.push(bs);
      }
    }
    return { tv, search };
  });
  return { chains, tv: chains.flatMap((c) => c.tv), search: chains.flatMap((c) => c.search), accept: acc / (draws * starts.length) };
}

/** Repeat the world: how far off is each method's TV ROI, and how often does it come out negative? */
export function mmmStudy(worlds: number, seed: number): Record<"ols" | "positive" | "lift", { rmse: number; negative: number }> {
  const out = { ols: { rmse: 0, negative: 0 }, positive: { rmse: 0, negative: 0 }, lift: { rmse: 0, negative: 0 } };
  for (let k = 0; k < worlds; k++) {
    const d = mmmWorld(seed + k);
    const ols = mmmOLS(d)[0];
    const pos = avg(mmmSample(d, "positive", seed + k, 1000, 500).tv);
    const lift = avg(mmmSample(d, "lift", seed + k, 1000, 500).tv);
    for (const [key, v] of [["ols", ols], ["positive", pos], ["lift", lift]] as const) {
      out[key].rmse += (v - MMM_TRUTH.tv) ** 2 / worlds;
      if (v < 0) out[key].negative += 1 / worlds;
    }
  }
  for (const v of Object.values(out)) v.rmse = Math.sqrt(v.rmse);
  return out;
}

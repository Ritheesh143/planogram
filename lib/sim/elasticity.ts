// Batch 3a: elasticities and choice. Own-price elasticity as a log-log slope, cross-price
// elasticities and cannibalization vs halo, the multinomial and nested logit from random utility,
// and why regressing sales on price goes wrong (endogeneity) and how pooling steadies per-SKU
// estimates. Every number a lesson quotes is computed here.

import { solve, xtx, xty, type Matrix } from "./linalg";
import { mulberry32, normal, type Rng } from "./rng";

export const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
};

/** Least squares coefficients for the rows of X (include a column of ones for an intercept). */
export function ols(X: Matrix, y: number[]): number[] {
  return solve(xtx(X), xty(X, y));
}

/** Slope of y on x with an intercept. */
export function olsSlope(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  return sxy / sxx;
}

// ---------- elasticity-derivative ----------

/** Wood glue: ₹200 sold 500 a week; after a supplier increase, ₹250 sold 256. Cost ₹150. */
export const EL = { p0: 200, q0: 500, p1: 250, q1: 256, cost: 150 };

/** % change in quantity over % change in price, measured from (pa, qa). */
export const pctRatio = (pa: number, qa: number, pb: number, qb: number) => (qb - qa) / qa / ((pb - pa) / pa);

/** The slope between two points on log-log axes. */
export const logElasticity = (pa: number, qa: number, pb: number, qb: number) => Math.log(qb / qa) / Math.log(pb / pa);

export const GLUE_EPS = logElasticity(EL.p0, EL.q0, EL.p1, EL.q1);

/** The straight line through the two weeks: Q = a − b·p. */
export const LINE = (() => {
  const b = (EL.q0 - EL.q1) / (EL.p1 - EL.p0);
  return { a: EL.q0 + b * EL.p0, b };
})();

export type DemandShape = "constant" | "line";

export function demandAt(shape: DemandShape, p: number, eps = GLUE_EPS): number {
  return shape === "constant" ? EL.q0 * (p / EL.p0) ** eps : Math.max(0, LINE.a - LINE.b * p);
}

/** Point elasticity (dQ/dp)·(p/Q). */
export function pointElasticity(shape: DemandShape, p: number, eps = GLUE_EPS): number {
  return shape === "constant" ? eps : (-LINE.b * p) / demandAt("line", p);
}

/** The profit-maximizing price: c·ε/(1+ε) for constant elasticity, (a + b·c)/2b for the line. */
export function bestPrice(shape: DemandShape, cost = EL.cost, eps = GLUE_EPS): number {
  if (shape === "constant") return eps < -1 ? (cost * eps) / (1 + eps) : Infinity;
  return (LINE.a + LINE.b * cost) / (2 * LINE.b);
}

export const profitAt = (shape: DemandShape, p: number, cost = EL.cost, eps = GLUE_EPS) => (p - cost) * demandAt(shape, p, eps);

/** Estimating ε from weekly data: how much the price moved decides how well it can be learned. */
export const EP = { eps: -3, noise: 0.25, reps: 1000, seed: 8, sds: [0.02, 0.05, 0.1, 0.2], weeks: [13, 26, 52, 104] };

export function elasticityStudy(priceSd: number, weeks: number, reps = EP.reps, seed = EP.seed) {
  const rng = mulberry32(seed);
  const estimates: number[] = [];
  for (let r = 0; r < reps; r++) {
    const x: number[] = [];
    const y: number[] = [];
    for (let t = 0; t < weeks; t++) {
      const lp = Math.log(EL.p0) + normal(rng, 0, priceSd);
      x.push(lp);
      y.push(Math.log(EL.q0) + EP.eps * (lp - Math.log(EL.p0)) + normal(rng, 0, EP.noise));
    }
    estimates.push(olsSlope(x, y));
  }
  return {
    estimates,
    mean: mean(estimates),
    sd: sd(estimates),
    theorySd: EP.noise / (priceSd * Math.sqrt(weeks)),
    inelastic: estimates.filter((e) => e > -1).length / reps,
    close: estimates.filter((e) => Math.abs(e - EP.eps) <= 0.5).length / reps,
  };
}

// ---------- cx-cross-elasticity ----------

export const PAINT = [
  { id: "kestrel", name: "Kestrel", price: 1000, cost: 650, base: 200 },
  { id: "lumen", name: "Lumen", price: 900, cost: 600, base: 300 },
  { id: "own", name: "Own label", price: 700, cost: 420, base: 150 },
  { id: "roller", name: "Roller kit", price: 300, cost: 180, base: 100 },
] as const;
export type PaintId = (typeof PAINT)[number]["id"];

/** The week Kestrel ran at 20% off. */
export const HAND_PROMO = { depth: 0.2, after: [320, 240, 135, 130] };

const revenue = PAINT.map((p) => p.price * p.base);

/**
 * CROSS[i][j]: the elasticity of product i's units with respect to product j's price.
 * Kestrel's column comes from the hand week; the other cross terms follow ε_ij·R_i = ε_ji·R_j
 * (Slutsky symmetry with revenues R), and the own-price terms are set directly.
 */
export const CROSS: Matrix = (() => {
  const l = Math.log(1 - HAND_PROMO.depth);
  const colA = HAND_PROMO.after.map((q, i) => Math.log(q / PAINT[i].base) / l);
  const M: Matrix = PAINT.map(() => new Array(PAINT.length).fill(0));
  colA.forEach((e, i) => (M[i][0] = e));
  M[1][1] = -2.5;
  M[2][2] = -2.0;
  M[3][3] = -1.5;
  M[1][2] = 0.3; // Lumen's units vs the own label's price
  M[3][1] = -1.0; // rollers vs Lumen's price
  M[3][2] = -0.5; // rollers vs the own label's price
  const sym = (i: number, j: number) => (M[j][i] = (M[i][j] * revenue[i]) / revenue[j]);
  sym(1, 0);
  sym(2, 0);
  sym(3, 0);
  sym(1, 2);
  sym(3, 1);
  sym(3, 2);
  return M;
})();

/** One product on promotion: units, margins and the item vs category view. */
export function promoOutcome(promoted: number, depth: number) {
  const vendorFunded = PAINT[promoted].id !== "own";
  const units = PAINT.map((p, i) => p.base * (1 - depth) ** CROSS[i][promoted]);
  const margin = PAINT.map((p, i) => (i === promoted && !vendorFunded ? p.price * (1 - depth) - p.cost : p.price - p.cost));
  const before = PAINT.map((p) => p.base * (p.price - p.cost));
  const after = units.map((u, i) => u * margin[i]);
  const paint = [0, 1, 2];
  const itemLift = units[promoted] - PAINT[promoted].base;
  const categoryLift = paint.reduce((s, i) => s + units[i] - PAINT[i].base, 0);
  const cannibalized = paint.filter((i) => i !== promoted).reduce((s, i) => s + PAINT[i].base - units[i], 0);
  const halo = units[3] - PAINT[3].base;
  const itemMargin = after[promoted] - before[promoted];
  const totalMargin = after.reduce((s, v) => s + v, 0) - before.reduce((s, v) => s + v, 0);
  return { units, margin, before, after, itemLift, categoryLift, cannibalized, halo, itemMargin, totalMargin, vendorFunded };
}

/** Learning Lumen's response to Kestrel's price from two years of weeks, as promos overlap more. */
export const CS = { weeks: 104, promoRate: 0.2, depth: 0.2, noise: 0.3, reps: 500, seed: 12, overlaps: [0, 0.25, 0.5, 0.75, 0.9] };

export function crossStudy(overlap: number, reps = CS.reps, seed = CS.seed) {
  const rng = mulberry32(seed);
  const truth = CROSS[1][0];
  const bAlone = (CS.promoRate * (1 - overlap)) / (1 - CS.promoRate);
  const estimates: number[] = [];
  let together = 0;
  let aWeeks = 0;
  for (let r = 0; r < reps; r++) {
    const X: Matrix = [];
    const y: number[] = [];
    for (let t = 0; t < CS.weeks; t++) {
      const a = rng() < CS.promoRate;
      const b = rng() < (a ? overlap : bAlone);
      if (a) aWeeks++;
      if (a && b) together++;
      const la = a ? Math.log(1 - CS.depth) : 0;
      const lb = b ? Math.log(1 - CS.depth) : 0;
      X.push([1, la, lb]);
      y.push(Math.log(PAINT[1].base) + truth * la + CROSS[1][1] * lb + normal(rng, 0, CS.noise));
    }
    const singular = X.every((row) => row[1] === row[2]) || X.every((row) => row[1] === 0) || X.every((row) => row[2] === 0);
    estimates.push(singular ? NaN : ols(X, y)[1]);
  }
  const ok = estimates.filter(Number.isFinite);
  return {
    truth,
    estimates: ok,
    sd: sd(ok),
    mean: mean(ok),
    wrongSign: ok.filter((e) => e <= 0).length / ok.length,
    far: ok.filter((e) => Math.abs(e - truth) > 0.5).length / ok.length,
    unusable: reps - ok.length,
    overlapSeen: together / aWeeks,
  };
}

// ---------- cx-mnl ----------

export const softmax = (v: number[]) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

/** Cordless drills. β is utility lost per ₹1,000 of price; α is set so the hand utilities are ln 4, ln 2, 0. */
export const DRILL = {
  beta: 0.8,
  names: ["Kestrel 20V", "Own-label 18V", "Budget 12V"],
  prices: [4500, 3000, 2000],
  hand: [Math.log(4), Math.log(2), 0],
  shoppers: 800,
};
const alpha = DRILL.hand.map((v, i) => v + (DRILL.beta * DRILL.prices[i]) / 1000);

export const drillUtility = (i: number, price: number) => alpha[i] - (DRILL.beta * price) / 1000;

export type Lineup = "three" | "stockout" | "red";

/**
 * Shares under a nested logit: the Kestrel colors share a nest with strength λ (λ = 1 is plain
 * MNL, λ → 0 makes them perfect substitutes). The last share is "no drill" (utility 0).
 */
export function drillShares(lineup: Lineup, ownPrice = DRILL.prices[1], lambda = 1) {
  const vK = drillUtility(0, DRILL.prices[0]);
  const vO = drillUtility(1, ownPrice);
  const vB = drillUtility(2, DRILL.prices[2]);
  const kestrels = lineup === "stockout" ? [] : lineup === "red" ? [vK, vK] : [vK];
  const nestSum = kestrels.reduce((s, v) => s + Math.exp(v / lambda), 0);
  const nestWeight = kestrels.length ? nestSum ** lambda : 0;
  const others = [vO, vB, 0].map(Math.exp);
  const total = nestWeight + others.reduce((a, b) => a + b, 0);
  const within = kestrels.map((v) => Math.exp(v / lambda) / nestSum);
  const names = [...(lineup === "red" ? ["Kestrel blue", "Kestrel red"] : lineup === "three" ? ["Kestrel 20V"] : []), "Own-label 18V", "Budget 12V", "No drill"];
  const shares = [...within.map((w) => (w * nestWeight) / total), ...others.map((o) => o / total)];
  return { names, shares, kestrel: nestWeight / total, own: others[0] / total, budget: others[1] / total, none: others[2] / total };
}

/** MNL elasticities: own −β·p_j·(1 − s_j), cross β·p_k·s_k (the same for every other option). */
export function mnlElasticities(prices = DRILL.prices, beta = DRILL.beta) {
  const s = softmax([...prices.map((p, i) => drillUtility(i, p)), 0]);
  return {
    shares: s,
    own: prices.map((p, i) => (-beta * p * (1 - s[i])) / 1000),
    cross: prices.map((p, i) => (beta * p * s[i]) / 1000),
  };
}

export const gumbel = (rng: Rng) => -Math.log(-Math.log(rng()));

/** Shoppers each draw a noise term per option and take the highest utility. */
export function randomUtilityStudy(n: number, noise: "gumbel" | "normal", seed = 31) {
  const rng = mulberry32(seed);
  const v = [...DRILL.hand, 0];
  const counts = new Array(v.length).fill(0);
  const s = Math.PI / Math.sqrt(6);
  for (let i = 0; i < n; i++) {
    let best = -Infinity;
    let pick = 0;
    v.forEach((vj, j) => {
      const u = vj + (noise === "gumbel" ? gumbel(rng) : normal(rng, 0, s));
      if (u > best) {
        best = u;
        pick = j;
      }
    });
    counts[pick]++;
  }
  const sim = counts.map((c) => c / n);
  const formula = softmax(v);
  return { sim, formula, gap: Math.max(...sim.map((x, j) => Math.abs(x - formula[j]))) };
}

// ---------- cx-endogeneity ----------

/** A 30 m garden hose: two off-season and two peak weeks. Truth: ε = −2, peak doubles demand. */
export const HOSE = [
  { season: "off", price: 1000, sold: 100 },
  { season: "off", price: 800, sold: 156 },
  { season: "peak", price: 1250, sold: 128 },
  { season: "peak", price: 1000, sold: 200 },
] as const;

export function hoseFits() {
  const x = HOSE.map((w) => Math.log(w.price));
  const y = HOSE.map((w) => Math.log(w.sold));
  const usual = logElasticity(HOSE[0].price, HOSE[0].sold, HOSE[2].price, HOSE[2].sold);
  const pooled = olsSlope(x, y);
  const withSeason = ols(
    HOSE.map((w, i) => [1, w.season === "peak" ? 1 : 0, x[i]]),
    y,
  )[2];
  return { usual, pooled, withSeason };
}

/** Prices that follow demand: log price = base + κ·shock + cost shock. */
export const EN = { weeks: 104, eps: -2, shockSd: 0.3, costSd: 0.08, noise: 0.1, seed: 13, kappas: [0, 0.1, 0.2, 0.3, 0.4] };

export function endogeneityWeeks(kappa: number, seed = EN.seed) {
  const rng = mulberry32(seed);
  const lp: number[] = [];
  const lq: number[] = [];
  const shock: number[] = [];
  const cost: number[] = [];
  for (let t = 0; t < EN.weeks; t++) {
    const u = normal(rng, 0, EN.shockSd);
    const c = normal(rng, 0, EN.costSd);
    const e = normal(rng, 0, EN.noise);
    const p = Math.log(1000) + kappa * u + c;
    shock.push(u);
    cost.push(c);
    lp.push(p);
    lq.push(Math.log(100) + EN.eps * (p - Math.log(1000)) + u + e);
  }
  const cov = (a: number[], b: number[]) => {
    const ma = mean(a);
    const mb = mean(b);
    return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / (a.length - 1);
  };
  return { lp, lq, shock, cost, naive: olsSlope(lp, lq), iv: cov(cost, lq) / cov(cost, lp) };
}

/** Sixty SKUs, each with its own true elasticity, estimated alone or partially pooled. */
export const HE = { skus: 60, mu: -2, tau: 0.5, priceSd: 0.08, noise: 0.25, maxWeeks: 104, seed: 2, weeks: [13, 26, 52, 104] };

export function hierStudy(weeks: number) {
  const rng = mulberry32(HE.seed);
  const truth: number[] = [];
  const raw: number[] = [];
  const se: number[] = [];
  for (let k = 0; k < HE.skus; k++) {
    const e = normal(rng, HE.mu, HE.tau);
    const x: number[] = [];
    const y: number[] = [];
    for (let t = 0; t < HE.maxWeeks; t++) {
      const lp = normal(rng, 0, HE.priceSd);
      const ly = e * lp + normal(rng, 0, HE.noise);
      if (t < weeks) {
        x.push(lp);
        y.push(ly);
      }
    }
    truth.push(e);
    const b = olsSlope(x, y);
    const mx = mean(x);
    const my = mean(y);
    const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
    const rss = x.reduce((s, v, i) => s + (y[i] - my - b * (v - mx)) ** 2, 0);
    raw.push(b);
    se.push(Math.sqrt(rss / (weeks - 2) / sxx));
  }
  // Empirical Bayes: the spread of raw estimates is true spread plus sampling noise.
  const mu = mean(raw);
  const tau2 = Math.max(0, raw.reduce((s, v) => s + (v - mu) ** 2, 0) / (raw.length - 1) - mean(se.map((s) => s * s)));
  const weight = se.map((s) => tau2 / (tau2 + s * s));
  const pooled = raw.map((b, i) => mu + weight[i] * (b - mu));
  const rmse = (est: number[]) => Math.sqrt(mean(est.map((v, i) => (v - truth[i]) ** 2)));
  return {
    truth,
    raw,
    se,
    pooled,
    weight,
    mu,
    tau: Math.sqrt(tau2),
    rmseRaw: rmse(raw),
    rmsePooled: rmse(pooled),
    positiveRaw: raw.filter((v) => v > 0).length,
    positivePooled: pooled.filter((v) => v > 0).length,
    inelasticRaw: raw.filter((v) => v > -1).length,
    inelasticPooled: pooled.filter((v) => v > -1).length,
    inelasticTrue: truth.filter((v) => v > -1).length,
  };
}

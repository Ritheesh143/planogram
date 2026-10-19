// Linear models from scratch: the one-feature derivative form, the normal equations,
// ridge, lasso, a gradient-descent path and a Poisson GLM.

import { dot, matVec, solve, xtx, xty, type Matrix } from "./linalg";

const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

export type Line = { intercept: number; slope: number; sse: number };

/** Set dSSE/da = 0 and dSSE/db = 0 for y ≈ a + b·x and solve: the hand-worked form. */
export function fitLine(x: number[], y: number[]): Line {
  const mx = avg(x);
  const my = avg(y);
  let sxy = 0;
  let sxx = 0;
  x.forEach((xi, i) => {
    sxy += (xi - mx) * (y[i] - my);
    sxx += (xi - mx) ** 2;
  });
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  return { intercept, slope, sse: sseLine(x, y, intercept, slope) };
}

export function sseLine(x: number[], y: number[], intercept: number, slope: number): number {
  return x.reduce((s, xi, i) => s + (y[i] - intercept - slope * xi) ** 2, 0);
}

/** One column of ones in front, for the intercept. */
export function withIntercept(X: Matrix): Matrix {
  return X.map((row) => [1, ...row]);
}

export type LinearFit = { coef: number[]; intercept: number };

/**
 * Least squares with an optional ridge penalty λ·Σβ² (the intercept is never penalized).
 * Columns are centered first, so the intercept is just the mean the slopes don't explain.
 */
export function fitLinear(X: Matrix, y: number[], ridge = 0): LinearFit {
  const p = X[0].length;
  const means = Array.from({ length: p }, (_, j) => avg(X.map((r) => r[j])));
  const my = avg(y);
  const Xc = X.map((r) => r.map((v, j) => v - means[j]));
  const yc = y.map((v) => v - my);
  const A = xtx(Xc).map((row, a) => row.map((v, b) => (a === b ? v + ridge : v)));
  const coef = solve(A, xty(Xc, yc));
  return { coef, intercept: my - dot(coef, means) };
}

export function predictLinear(fit: LinearFit, row: number[]): number {
  return fit.intercept + dot(fit.coef, row);
}

/** Lasso by coordinate descent on centered data: each slope is soft-thresholded in turn. */
export function fitLasso(X: Matrix, y: number[], alpha: number, iters = 500): LinearFit {
  const n = X.length;
  const p = X[0].length;
  const means = Array.from({ length: p }, (_, j) => avg(X.map((r) => r[j])));
  const my = avg(y);
  const Xc = X.map((r) => r.map((v, j) => v - means[j]));
  const yc = y.map((v) => v - my);
  const coef = new Array(p).fill(0);
  const colSq = Array.from({ length: p }, (_, j) => Xc.reduce((s, r) => s + r[j] ** 2, 0));
  for (let it = 0; it < iters; it++) {
    for (let j = 0; j < p; j++) {
      let rho = 0;
      for (let i = 0; i < n; i++) {
        const partial = yc[i] - dot(Xc[i], coef) + Xc[i][j] * coef[j];
        rho += Xc[i][j] * partial;
      }
      // Objective: ½Σ(residual²) + alpha·Σ|β|.
      const shrunk = Math.max(Math.abs(rho) - alpha, 0);
      coef[j] = shrunk === 0 ? 0 : (Math.sign(rho) * shrunk) / colSq[j];
    }
  }
  return { coef, intercept: my - dot(coef, means) };
}

export type GradientStep = { intercept: number; slope: number; sse: number };

/** Plain gradient descent on SSE for one feature: the path a learner can watch. */
export function gradientPath(x: number[], y: number[], lr: number, steps: number, start = { intercept: 0, slope: 0 }): GradientStep[] {
  let { intercept, slope } = start;
  const out: GradientStep[] = [{ intercept, slope, sse: sseLine(x, y, intercept, slope) }];
  for (let s = 0; s < steps; s++) {
    let ga = 0;
    let gb = 0;
    x.forEach((xi, i) => {
      const r = y[i] - intercept - slope * xi;
      ga += -2 * r;
      gb += -2 * r * xi;
    });
    intercept -= lr * ga;
    slope -= lr * gb;
    out.push({ intercept, slope, sse: sseLine(x, y, intercept, slope) });
  }
  return out;
}

/**
 * Poisson regression with a log link, fitted by iteratively reweighted least squares.
 * Predictions exp(Xβ) can never go below zero, which is the point for unit sales.
 */
export function fitPoisson(X: Matrix, y: number[], iters = 50): LinearFit {
  const Xi = withIntercept(X);
  const p = Xi[0].length;
  const start = Math.log(Math.max(avg(y), 1e-6));
  let beta = [start, ...new Array(p - 1).fill(0)];
  for (let it = 0; it < iters; it++) {
    const eta = matVec(Xi, beta);
    const mu = eta.map((e) => Math.exp(e));
    // Working response z and weights w = μ.
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / mu[i]);
    const WX = Xi.map((row, i) => row.map((v) => v * mu[i]));
    const A: Matrix = Array.from({ length: p }, (_, a) =>
      Array.from({ length: p }, (_, b) => Xi.reduce((s, row, i) => s + row[a] * WX[i][b], 0)),
    );
    const rhs = Array.from({ length: p }, (_, a) => Xi.reduce((s, row, i) => s + WX[i][a] * z[i], 0));
    const next = solve(A, rhs);
    const moved = Math.max(...next.map((v, j) => Math.abs(v - beta[j])));
    beta = next;
    if (moved < 1e-10) break;
  }
  return { intercept: beta[0], coef: beta.slice(1) };
}

export function predictPoisson(fit: LinearFit, row: number[]): number {
  return Math.exp(fit.intercept + dot(fit.coef, row));
}

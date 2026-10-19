// Math Toolkit helpers: thin-bar sums for integrals, and vectors as baskets.

import { dot } from "./linalg";
import { mulberry32, type Rng } from "./rng";

export type BarRule = "left" | "right" | "mid";

/** Σ f(x)·Δx over n equal bars on [a, b], with each bar's height taken at its left edge, right edge or middle. */
export function barSum(f: (x: number) => number, a: number, b: number, n: number, rule: BarRule = "mid"): number {
  const dx = (b - a) / n;
  const shift = rule === "left" ? 0 : rule === "right" ? 1 : 0.5;
  let s = 0;
  for (let i = 0; i < n; i++) s += f(a + (i + shift) * dx) * dx;
  return s;
}

export function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

export function cosine(a: number[], b: number[]): number {
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
}

export function distance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

export type Shopper = { kind: "painter" | "driller"; contractor: boolean; basket: number[] };

/**
 * Random baskets over [paint, brush, tape, drill, bits] from two kinds of shopper.
 * Basket sizes vary a lot: a contractor buys six times what a homeowner does.
 */
export function randomShoppers(n: number, seed: number): Shopper[] {
  const rng: Rng = mulberry32(seed);
  const pick = (p: number) => (rng() < p ? 1 + Math.floor(rng() * 3) : 0);
  return Array.from({ length: n }, () => {
    const painter = rng() < 0.5;
    const contractor = rng() < 0.2; // one shopper in five is a contractor buying six times as much
    const scale = contractor ? 6 : 1;
    const base = painter ? [pick(0.95), pick(0.8), pick(0.6), pick(0.1), pick(0.1)] : [pick(0.1), pick(0.1), pick(0.2), pick(0.9), pick(0.8)];
    return { kind: painter ? "painter" : "driller", contractor, basket: base.map((v) => v * scale) };
  });
}

/** The k shoppers whose baskets score highest against a query basket (ties keep list order). */
export function topK(shoppers: Shopper[], query: number[], k: number, score: (a: number[], b: number[]) => number): Shopper[] {
  return shoppers
    .filter((s) => s.basket.some((v) => v > 0))
    .map((s, i) => ({ s, i, v: score(query, s.basket) }))
    .sort((x, y) => y.v - x.v || x.i - y.i)
    .slice(0, k)
    .map((r) => r.s);
}

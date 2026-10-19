import { describe, expect, it } from "vitest";
import { BASKET_A, BASKET_B, BASKET_C, COSTS, ENDCAP_A, ENDCAP_B, PRICES, SHOPPERS, UNITS } from "@/components/viz/MathToolkit";
import { betaCdf, betaPdf } from "@/lib/sim/bayes";
import { dot, matVec, transpose, xtx } from "@/lib/sim/linalg";
import { mulberry32 } from "@/lib/sim/rng";
import { barSum, cosine, distance, norm, topK } from "@/lib/sim/toolkit";

const endcap = (x: number) => betaPdf(x, ENDCAP_A, ENDCAP_B);

describe("integrals as thin bars", () => {
  it("four bars under 2x give 0.75, 1.25 and 1; 100 bars give 0.99 and 1.01", () => {
    const f = (x: number) => 2 * x;
    expect(barSum(f, 0, 1, 4, "left")).toBeCloseTo(0.75, 12);
    expect(barSum(f, 0, 1, 4, "right")).toBeCloseTo(1.25, 12);
    expect(barSum(f, 0, 1, 4, "mid")).toBeCloseTo(1, 12);
    expect(barSum(f, 0, 1, 100, "left")).toBeCloseTo(0.99, 12);
    expect(barSum(f, 0, 1, 100, "right")).toBeCloseTo(1.01, 12);
    expect(barSum(f, 0, 1, 10, "left")).toBeCloseTo(0.9, 12);
  });

  it("matches the 10-bar Beta(5, 15) table", () => {
    const heights = Array.from({ length: 10 }, (_, i) => endcap(0.05 + 0.1 * i));
    expect(heights.slice(0, 7).map((h) => +h.toFixed(3))).toEqual([0.177, 3.025, 4.047, 2.097, 0.553, 0.074, 0.004]);
    expect(heights.slice(7).every((h) => h < 0.0005)).toBe(true);
    expect(barSum(endcap, 0, 1, 10)).toBeCloseTo(0.9977, 4);
    expect(barSum(endcap, 0, 0.3, 3)).toBeCloseTo(0.7249, 4);
    expect(barSum((x) => x * endcap(x), 0, 1, 10)).toBeCloseTo(0.25, 4);
    // With heights rounded to 3 decimals, as in the table, the mean sum is still 0.2500.
    const rounded = heights.map((h) => +h.toFixed(3));
    expect(rounded.reduce((s, h, i) => s + (0.05 + 0.1 * i) * h * 0.1, 0)).toBeCloseTo(0.25, 4);
    // Upper tail from the table vs exact.
    expect(rounded.slice(4).reduce((s, h) => s + h * 0.1, 0)).toBeCloseTo(0.0631, 4);
    expect(1 - betaCdf(0.4, ENDCAP_A, ENDCAP_B)).toBeCloseTo(0.0696, 4);
  });

  it("exact areas, the mode, and convergence with more bars", () => {
    expect(betaCdf(0.3, ENDCAP_A, ENDCAP_B)).toBeCloseTo(0.7178, 4);
    expect(betaCdf(0.2, ENDCAP_A, ENDCAP_B)).toBeCloseTo(0.3267, 4);
    expect(betaCdf(0.3, ENDCAP_A, ENDCAP_B) - betaCdf(0.2, ENDCAP_A, ENDCAP_B)).toBeCloseTo(0.39, 2);
    expect(barSum(endcap, 0, 0.3, 15)).toBeCloseTo(0.7181, 4); // 50 bars on [0, 1]
    expect(barSum(endcap, 0, 0.3, 150)).toBeCloseTo(0.7178, 4); // 500 bars on [0, 1]
    expect(barSum(endcap, 0, 1, 500)).toBeCloseTo(1, 4);
    let peak = 0;
    for (let i = 1; i < 1000; i++) peak = Math.max(peak, endcap(i / 1000));
    expect(peak).toBeCloseTo(4.2, 1);
    expect(endcap(0.25)).toBeCloseTo(4.05, 2);
    expect(1 - betaCdf(0.45, ENDCAP_A, ENDCAP_B)).toBeLessThan(0.05);
  });

  it("darts: 0.81 after 100, 0.7785 after 1,000, 0.7146 after 10,000", () => {
    const rng = mulberry32(12);
    let under = 0;
    const est: number[] = [];
    for (let n = 1; n <= 10000; n++) {
      const x = rng();
      const y = rng() * 4.5;
      if (x <= 0.3 && y <= endcap(x)) under++;
      if (n === 100 || n === 1000 || n === 10000) est.push((under / n) * 4.5);
    }
    expect(est[0]).toBeCloseTo(0.81, 4);
    expect(est[1]).toBeCloseTo(0.7785, 4);
    expect(est[2]).toBeCloseTo(0.7146, 4);
  });

  it("two middle bars under 6x(1 − x) give 1.125", () => {
    expect(barSum((x) => 6 * x * (1 - x), 0, 1, 2)).toBeCloseTo(1.125, 12);
    expect(barSum((x) => x * (1 - x), 0, 1, 2000)).toBeCloseTo(1 / 6, 6);
  });
});

describe("vectors as baskets", () => {
  const D = BASKET_B.map((v) => 10 * v);
  it("matches the hand-worked dot products, lengths, cosines and distances", () => {
    expect(dot(BASKET_A, BASKET_B)).toBe(3);
    expect(dot(BASKET_A, BASKET_C)).toBe(0);
    expect([norm(BASKET_A), norm(BASKET_B), norm(BASKET_C)].map((v) => +v.toFixed(3))).toEqual([2.449, 1.414, 2.236]);
    expect(cosine(BASKET_A, BASKET_B)).toBeCloseTo(0.866, 3);
    expect(dot(BASKET_A, D)).toBe(30);
    expect(cosine(BASKET_A, D)).toBeCloseTo(cosine(BASKET_A, BASKET_B), 12);
    expect(distance(BASKET_A, BASKET_B)).toBeCloseTo(1.414, 3);
    expect(distance(BASKET_A, BASKET_C)).toBeCloseTo(3.317, 3);
    expect(distance(BASKET_B, D)).toBeCloseTo(12.73, 2);
    const prices = [500, 150, 120, 4000, 600];
    expect(dot(BASKET_A, prices)).toBe(1270);
    expect(dot(BASKET_C, prices)).toBe(5200);
    expect(dot(BASKET_A, [-50, 0, 0, 0, 0])).toBe(-100);
  });

  it("exercises and the two-SKU plane", () => {
    expect(dot([1, 0, 2, 0, 0], [3, 1, 1, 0, 0])).toBe(5);
    expect(norm([0, 0, 0, 3, 4])).toBe(5);
    expect(cosine([1, 1, 0, 0, 0], [0, 1, 1, 0, 0])).toBeCloseTo(0.5, 12);
    expect(dot([2, 1], [1, 1])).toBe(3);
    expect(cosine([2, 1], [1, 1])).toBeCloseTo(0.949, 3);
    expect(cosine([2, 1], [6, 6])).toBeCloseTo(0.949, 3);
    expect(dot([2, 1], [6, 6])).toBe(18);
    expect(cosine([2, 1], [4, 2])).toBeCloseTo(1, 12);
  });

  it("dot product finds contractors; cosine finds the same mix", () => {
    const count = (q: number[], f: (a: number[], b: number[]) => number) => {
      const t = topK(SHOPPERS, q, 10, f);
      return { contractors: t.filter((s) => s.contractor).length, painters: t.filter((s) => s.kind === "painter").length };
    };
    expect(SHOPPERS.filter((s) => s.contractor).length).toBe(201);
    expect(count(BASKET_A, dot)).toEqual({ contractors: 10, painters: 10 });
    expect(count(BASKET_A, cosine)).toEqual({ contractors: 0, painters: 10 });
    expect(count(BASKET_C, dot)).toEqual({ contractors: 10, painters: 0 });
    expect(count(BASKET_C, cosine).painters).toBe(0);
    expect(count(BASKET_B, dot).contractors).toBe(10);
    expect(count(BASKET_B, cosine).contractors).toBe(5);
  });
});

describe("matrices as store × SKU tables", () => {
  it("revenue, cost, margins, column totals and UᵀU", () => {
    expect(matVec(UNITS, PRICES)).toEqual([29500, 35500, 37750]);
    expect(matVec(UNITS, COSTS)).toEqual([20900, 25550, 27950]);
    expect(matVec(UNITS, PRICES).map((r, i) => r - matVec(UNITS, COSTS)[i])).toEqual([8600, 9950, 9800]);
    const totals = matVec(transpose(UNITS), [1, 1, 1]);
    expect(totals).toEqual([75, 35, 15]);
    expect(dot(totals, PRICES)).toBe(102750);
    expect(xtx(UNITS)).toEqual([
      [2325, 950, 285],
      [950, 525, 160],
      [285, 160, 93],
    ]);
    expect(matVec(UNITS, [-50, 0, 0])).toEqual([-2000, -1250, -500]);
    expect(matVec([[3, 1], [0, 2]], [100, 50])).toEqual([350, 100]);
  });

  it("1,000 price scenarios: average revenue equals revenue at average prices", () => {
    const rng = mulberry32(21);
    const spread = 0.1;
    const scen = Array.from({ length: 1000 }, () => PRICES.map((p) => p * (1 - spread + 2 * spread * rng())));
    const chain = scen.map((p) => matVec(UNITS, p).reduce((a, b) => a + b, 0));
    const mean = chain.reduce((a, b) => a + b, 0) / chain.length;
    const avgPrice = PRICES.map((_, j) => scen.reduce((s, p) => s + p[j], 0) / scen.length);
    expect(Math.round(mean)).toBe(102891);
    expect(matVec(UNITS, avgPrice).reduce((a, b) => a + b, 0)).toBeCloseTo(mean, 6);
    expect(Math.min(...chain)).toBeGreaterThan(93000);
    expect(Math.max(...chain)).toBeLessThan(113000);
  });
});

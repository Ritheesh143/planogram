import { describe, expect, it } from "vitest";
import {
  censoredLogLik,
  censoredMLE,
  censorStudy,
  classify,
  conditionalMean,
  croston,
  DRILL,
  drillMean,
  drillSeries,
  estimates,
  expectedSales,
  HAND_DRILL,
  HAND_SALES,
  HAND_SHELF,
  intermittentStudy,
  logPmf,
  mean,
  MINT_SD,
  mintStudy,
  reconcile,
  reconcile3,
  reconciledSd,
  S3,
  S7,
  sesForecasts,
  shelfDays,
  spiral,
  tail,
  tsb,
  tweedieGradHess,
  tweedieParams,
} from "@/lib/sim/demand";
import { CS_DAYS, CS_SEED, DR_SEED, IS_ALPHA, IS_SEED, IS_SERIES, intermittentForecast, SP_LAMBDA, SP_SEED, SP_WEEKS } from "@/components/viz/HardDemand";
import { boostRuns, MT_REPS, MT_SEED, TW_MUS, tweedieDraws } from "@/components/viz/GlobalModels";

const r = (v: number, d: number) => Number(v.toFixed(d));

describe("fc-censored-demand", () => {
  it("the hand-worked likelihood", () => {
    expect(HAND_SALES.reduce((s, v) => s + v, 0)).toBe(109);
    const e = estimates(HAND_SALES, HAND_SHELF);
    expect([e.naive, e.dropped, e.mle, e.stockouts]).toEqual([10.9, 9.8, 12.23, 0.5]);
    const open = HAND_SALES.filter((y) => y < 12);
    const rows = [10, 11, 12, 13, 14].map((l) => [
      r(tail(12, l), 3),
      r(open.reduce((s, y) => s + logPmf(y, l), 0), 2),
      r(5 * Math.log(tail(12, l)), 2),
      r(censoredLogLik(HAND_SALES, 12, l), 2),
    ]);
    expect(rows).toEqual([
      [0.303, -10.69, -5.97, -16.66],
      [0.421, -11.02, -4.33, -15.35],
      [0.538, -11.76, -3.1, -14.85],
      [0.647, -12.83, -2.18, -15.01],
      [0.74, -14.2, -1.51, -15.71],
    ]);
    expect(r(12.23 / 10.9 - 1, 2)).toBe(0.12);
    expect(r(12.23 / 9.8 - 1, 2)).toBe(0.25);
    expect(r(expectedSales(12, 12), 2)).toBe(10.63);
    expect(r(12 - expectedSales(12, 12), 1)).toBe(1.4);
  });

  it("the shelf explorer", () => {
    const row = (l: number, s: number) => {
      const d = shelfDays(l, s, CS_DAYS, CS_SEED);
      const e = estimates(d.sales, s);
      return [Math.round(e.stockouts * 100), r(e.naive, 2), r(e.dropped, 2), e.mle];
    };
    expect(row(12, 12)).toEqual([55, 10.73, 9.16, 12.19]);
    expect(r(mean(shelfDays(12, 12, CS_DAYS, CS_SEED).demand), 2)).toBe(12.48);
    expect(row(12, 16)).toEqual([20, 12.04, 11.07, 12.37]);
    expect(row(12, 20)).toEqual([5, 12.43, 12, 12.49]);
    expect(row(12, 9)).toEqual([84, 8.68, 7, 11.95]);
    expect(row(16, 12)).toEqual([88, 11.66, 9.29, 15.88]);
  });

  it("the spiral and the bias table", () => {
    const naive = spiral(SP_LAMBDA, SP_WEEKS, "naive", SP_SEED);
    const mle = spiral(SP_LAMBDA, SP_WEEKS, "mle", SP_SEED);
    expect(naive.shelves).toEqual([12, 11, 11, 11, 11, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 9]);
    expect(r(naive.lostShare * 100, 1)).toBe(19.4);
    expect(r(mle.lostShare * 100, 1)).toBe(9.7);
    expect(Math.min(...mle.shelves)).toBeGreaterThanOrEqual(11);
    const t = censorStudy(12, [10, 12, 14, 16, 20], 300, 3);
    expect(t.map((x) => r(x.stockout * 100, 1))).toEqual([75.8, 53.8, 31.8, 15.6, 2.1]);
    expect(t.map((x) => r(x.naive, 2))).toEqual([9.46, 10.63, 11.37, 11.7, 11.93]);
    expect(t.map((x) => r(x.dropped, 2))).toEqual([7.71, 9.03, 10.18, 10.93, 11.74]);
    expect(t.map((x) => r(x.mle, 2))).toEqual([12.21, 12.08, 12.01, 11.95, 11.96]);
    expect(t.map((x) => r(x.mleSd, 2))).toEqual([0.88, 0.83, 0.69, 0.66, 0.63]);
  });

  it("the exercises", () => {
    const wk = [14, 20, 17, 20, 20, 12, 16];
    expect(r(mean(wk), 1)).toBe(17);
    expect(mean(wk.filter((v) => v < 20))).toBe(14.75);
    expect(r(1 - expectedSales(12, 12) / 12, 3)).toBe(0.114);
    expect(r(conditionalMean(12, 10.9), 2)).toBe(14.08);
    expect(r((49 + 5 * 14.08) / 10, 2)).toBe(11.94);
    expect(censoredMLE(new Array(14).fill(6), 6)).toBeGreaterThan(50);
  });
});

describe("fc-intermittent", () => {
  it("the hand-worked methods", () => {
    expect(mean(HAND_DRILL)).toBe(0.75);
    expect(sesForecasts(HAND_DRILL, 0.2, 0).map((v) => r(v, 3))).toEqual([0, 0, 0, 0.6, 0.48, 0.384, 0.307, 0.646, 0.517, 1.213, 0.971, 0.777, 0.621]);
    const c = croston(HAND_DRILL, 0.2);
    expect(c.forecast.map((v) => (v === null ? null : r(v, 3)))).toEqual([null, null, null, 1, 1, 1, 1, 0.875, 0.875, 1.027, 1.027, 1.027, 1.027]);
    expect([r(c.z[7] as number, 2), r(c.p[7] as number, 2), r(c.z[12] as number, 2), r(c.p[12] as number, 2)]).toEqual([2.8, 3.2, 3.04, 2.96]);
    expect(r(croston(HAND_DRILL, 0.2, true).forecast[12] as number, 3)).toBe(0.924);
    const t = tsb(HAND_DRILL, 0.2, 0.2);
    expect([3, 4, 5, 6, 7].map((i) => r(t.d[i] as number, 3))).toEqual([0.333, 0.267, 0.213, 0.171, 0.337]);
    expect(r(t.forecast[12] as number, 3)).toBe(0.647);
  });

  it("the discontinued drill", () => {
    const y = drillSeries(DR_SEED);
    const row = (m: "ses" | "croston" | "sba" | "tsb", a: number) => {
      const f = intermittentForecast(m, y, a);
      return [r(f[DRILL.stopAt] ?? 0, 3), r(f[DRILL.weeks] ?? 0, 3), r(f.slice(DRILL.stopAt, DRILL.weeks).reduce<number>((s, v) => s + (v ?? 0), 0), 1)];
    };
    expect(row("croston", 0.1)).toEqual([0.633, 0.633, 16.5]);
    expect(row("sba", 0.1)).toEqual([0.602, 0.602, 15.6]);
    expect(row("tsb", 0.1)).toEqual([0.767, 0.05, 7.2]);
    expect(row("ses", 0.1)).toEqual([0.809, 0.052, 7.6]);
    expect(row("croston", 0.2)).toEqual([0.738, 0.738, 19.2]);
    expect(row("tsb", 0.2)).toEqual([0.987, 0.003, 4.9]);
    const c = classify(y.slice(0, DRILL.stopAt));
    expect([y.slice(0, 78).filter((v) => v > 0).length, r(c.adi, 2), r(c.cv2, 3), c.kind]).toEqual([22, 3.55, 0.318, "intermittent"]);
    expect(drillMean).toBe(0.75);
  });

  it("the bias study", () => {
    const s = intermittentStudy(IS_SERIES, IS_ALPHA, IS_SEED);
    expect([s.ses.mean, s.croston.mean, s.sba.mean, s.tsb.mean].map((v) => r(v, 3))).toEqual([0.752, 0.798, 0.758, 0.756]);
    expect([s.ses.rmse, s.croston.rmse, s.sba.rmse, s.tsb.rmse].map((v) => r(v, 3))).toEqual([0.304, 0.222, 0.206, 0.286]);
    expect(r(s.croston.mean / 0.75 - 1, 2)).toBe(0.06);
    expect(r(0.95 * 0.798, 3)).toBe(0.758);
  });

  it("the exercises", () => {
    expect(52 / 13).toBe(4);
    expect([4 / 5, 0.95 * 0.8].map((v) => r(v, 2))).toEqual([0.8, 0.76]);
    expect([r(2.8 + 0.2 * 2.2, 2), r(3.2 + 0.2 * 2.8, 2), r(3.24 / 3.76, 3)]).toEqual([3.24, 3.76, 0.862]);
    expect(r(0.3 * 0.9 ** 10, 3)).toBe(0.105);
    expect(r(0.3 * 0.9 ** 10 * 2.5, 2)).toBe(0.26);
    expect(r(0.6 * 0.8 ** 4, 3)).toBe(0.246);
    expect([0.7 ** 2, 2 * 0.3 * 0.7, 0.3 ** 2].map((v) => r(v, 2))).toEqual([0.49, 0.42, 0.09]);
  });
});

describe("fc-tweedie-lgbm", () => {
  it("the hand-worked Tweedie day and Newton step", () => {
    const t = tweedieParams(2, 1, 1.5);
    expect([r(t.lambda, 2), r(Math.exp(-t.lambda), 3), t.shape, r(t.scale, 3)]).toEqual([2.83, 0.059, 1, 0.707]);
    expect(r(t.lambda * t.shape * t.scale, 6)).toBe(2);
    expect(r(2 ** 1.5, 2)).toBe(2.83);
    const gh = [0, 0, 3, 1].map((y) => tweedieGradHess(y, Math.log(2), 1.5));
    expect(gh.map(([g]) => r(g, 3))).toEqual([1.414, 1.414, -0.707, 0.707]);
    expect(gh.map(([, h]) => r(h, 3))).toEqual([0.707, 0.707, 1.768, 1.061]);
    const G = gh.reduce((s, x) => s + x[0], 0);
    const H = gh.reduce((s, x) => s + x[1], 0);
    expect([r(G, 3), r(H, 3), r(-G / H, 3), r(2 * Math.exp(-G / H), 2)]).toEqual([2.828, 4.243, -0.667, 1.03]);
    expect(r(1.4 * 1.5 * 2, 1)).toBe(4.2);
  });

  it("the shape explorer", () => {
    const at = (mu: number, p: number) => {
      const d = tweedieDraws(mu, p);
      const m = mean(d);
      return { p0: Math.exp(-tweedieParams(mu, 1, p).lambda), zeros: d.filter((v) => v === 0).length / d.length, mean: m, v: d.reduce((s, x) => s + (x - m) ** 2, 0) / (d.length - 1) };
    };
    expect(TW_MUS).toEqual([0.3, 0.5, 1, 2, 5, 10]);
    const a = at(2, 1.5);
    expect([r(a.p0, 3), r(a.zeros, 3), r(a.mean, 2), r(a.v, 2)]).toEqual([0.059, 0.057, 2.01, 2.76]);
    expect(r(tweedieParams(0.3, 1, 1.2).lambda, 3)).toBe(0.477);
    expect(r(at(0.3, 1.2).p0, 3)).toBe(0.621);
    expect(r(at(0.3, 1.5).p0, 2)).toBe(0.33);
    expect(r(at(10, 1.1).v, 2)).toBe(12.59);
    expect(Math.round(at(10, 1.9).v)).toBe(74);
    expect(r(10 ** 1.9, 1)).toBe(79.4);
  });

  it("the global boosting study", () => {
    const summary = (depth: number) =>
      boostRuns(depth).map((x) => {
        const e = x.curve[x.curve.length - 1];
        const b = x.curve.reduce((a, c) => (c.truth < a.truth ? c : a));
        return { truth: r(e.truth * 100, 1), wape: r(e.wape * 100, 1), neg: e.negatives, best: b.rounds, bestTruth: r(b.truth * 100, 1) };
      });
    const d1 = summary(1);
    expect(d1.map((x) => x.truth)).toEqual([183.4, 11.3, 9.6]);
    expect(d1[0].neg).toBe(285);
    expect([d1[0].wape, d1[2].wape]).toEqual([60, 49.8]);
    const d4 = summary(4);
    expect(d4.map((x) => x.truth)).toEqual([23.8, 22.8, 22.9]);
    expect(d4.map((x) => x.bestTruth)).toEqual([17.9, 15.2, 14.4]);
    expect(d4.map((x) => x.best)).toEqual([70, 70, 50]);
    expect([d4[0].wape, d4[2].wape]).toEqual([51.8, 51.5]);
  }, 30_000);

  it("the exercises", () => {
    expect(tweedieParams(1, 1, 1.5).lambda).toBe(2);
    expect(r(Math.exp(-2), 3)).toBe(0.135);
    expect([4 ** 1, 4 ** 1.5, 4 ** 2]).toEqual([4, 8, 16]);
    expect([tweedieGradHess(0, Math.log(4), 1.5)[0], tweedieGradHess(10, Math.log(4), 1.5)[0]].map((v) => r(v, 6))).toEqual([2, -3]);
    expect(r(Math.log(1.5) + Math.log(2) + Math.log(1.4), 3)).toBe(1.435);
    expect(r(Math.exp(1.435), 1)).toBe(4.2);
  });
});

describe("fc-mint", () => {
  it("the hand-worked reconciliations", () => {
    const y = [100, 60, 45];
    const v = [25, 16, 9];
    const at = (m: Parameters<typeof reconcile3>[2], vars = v) => reconcile3(y, vars, m).map((x) => r(x, 2));
    expect(at("bottomup")).toEqual([105, 60, 45]);
    expect(at("topdown")).toEqual([100, 57.14, 42.86]);
    expect(at("ols")).toEqual([101.67, 58.33, 43.33]);
    expect(at("wls")).toEqual([102.5, 58.4, 44.1]);
    expect(at("wls", [1, 16, 9])).toEqual([100.19, 56.92, 43.27]);
    expect(at("wls", [100, 16, 9])).toEqual([104, 59.36, 44.64]);
    expect(reconcile3([105, 60, 45], v, "wls").map((x) => r(x, 6))).toEqual([105, 60, 45]);
    expect(reconcile(S3, y, [1, 1, 1]).map((x) => r(x, 2))).toEqual([101.67, 58.33, 43.33]);
    expect([100 + 60, 100 + 45]).toEqual([160, 145]);
    expect([r((2 * 160 - 145) / 3, 2), r((2 * 145 - 160) / 3, 2)]).toEqual([58.33, 43.33]);
  });

  it("the seven-node study", () => {
    const s = mintStudy(MT_REPS, MT_SEED);
    const row = (k: keyof typeof s) => [r(s[k].total, 1), r(s[k].regions, 1), r(s[k].stores, 1)];
    expect(row("base")).toEqual([25, 20, 15]);
    expect(row("bottomup")).toEqual([29.9, 21.2, 15]);
    expect(row("ols")).toEqual([16.9, 13.6, 12.7]);
    expect(row("wls")).toEqual([15.8, 13, 12.5]);
    expect(Math.sqrt(4 * 15 ** 2)).toBe(30);
    expect(reconciledSd(S7, MINT_SD.map((x) => x * x), MINT_SD).map((x) => r(x, 2)).filter((_, i) => [0, 1, 3].includes(i))).toEqual([15.89, 13, 12.44]);
    expect(reconciledSd(S7, MINT_SD.map(() => 1), MINT_SD).map((x) => r(x, 2)).filter((_, i) => [0, 1, 3].includes(i))).toEqual([16.96, 13.63, 12.61]);
  });

  it("the exercises", () => {
    expect(reconcile3([200, 120, 70], [1, 1, 1], "ols").map((x) => r(x, 2))).toEqual([196.67, 123.33, 73.33]);
    expect(reconcile3([200, 120, 70], [4, 16, 20], "wls").map((x) => r(x, 6))).toEqual([199, 124, 75]);
    expect(r(12 * Math.sqrt(10), 1)).toBe(37.9);
  });
});

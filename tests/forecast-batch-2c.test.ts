import { describe, expect, it } from "vitest";
import {
  CF,
  conformalQ,
  conformalStudy,
  criticalRatio,
  DP,
  fitGlobal,
  HAND_RESID,
  HAND_TINS,
  leadTimeP90,
  leadTimeSd,
  mean,
  nbCover,
  NV,
  NV_HAND,
  orderOutcome,
  pinballArgmin,
  pinballTotal,
  pmfArray,
  pmfQuantile,
  poissonCdf,
  poissonInterval,
  policyStudy,
  promoEffect,
  promoLift,
  promoStudy,
  ruleService,
  samplePaths,
  seasonSkus,
  SS,
  tableProfit,
  tintDays,
  tokenize,
} from "@/lib/sim/uncertainty";
import { CF_REPS, CF_SEED, promoExample } from "@/components/viz/Uncertainty";
import { deepPaths, globalRuns } from "@/components/viz/ToProduction";
import { normalQuantile } from "@/lib/sim/prob";

const r = (v: number, d: number) => Number(v.toFixed(d));

describe("fc-pinball", () => {
  it("the hand-worked pinball losses", () => {
    expect([...HAND_TINS].sort((a, b) => a - b)).toEqual([3, 5, 6, 6, 7, 8, 9, 10, 12, 18]);
    expect(mean(HAND_TINS)).toBe(8.4);
    expect([9, 10, 11, 12].map((q) => r(pinballTotal(HAND_TINS, q, 0.75), 2))).toEqual([14.5, 14, 14.5, 15]);
    expect(pinballArgmin(HAND_TINS, 0.75)).toBe(10);
    expect(HAND_TINS.filter((v) => v <= 10).length).toBe(8);
    // Slopes either side of 10
    expect(r(pinballTotal(HAND_TINS, 10, 0.75) - pinballTotal(HAND_TINS, 9, 0.75), 2)).toBe(-0.5);
    expect(r(pinballTotal(HAND_TINS, 11, 0.75) - pinballTotal(HAND_TINS, 10, 0.75), 2)).toBe(0.5);
    expect(6 / (6 + 2)).toBe(0.75);
  });

  it("the hand-worked conformal interval", () => {
    expect([...HAND_RESID].sort((a, b) => a - b)).toEqual([2, 3, 3, 5, 6, 7, 8, 11, 14]);
    expect(conformalQ(HAND_RESID, 0.2)).toBe(11);
    expect(poissonInterval()).toEqual([14, 26]);
    expect(HAND_RESID.filter((e) => e <= 6).length).toBe(5);
    expect(r(poissonCdf(14, 20), 4)).toBe(0.1049);
    expect(conformalQ(HAND_RESID, 0.05)).toBe(Infinity);
    expect(Math.ceil(20 * 0.9)).toBe(18);
  });

  it("the pinball dial on 200 days", () => {
    const d = tintDays();
    expect(r(mean(d), 1)).toBe(7.6);
    const rows = [0.5, 0.75, 0.9, 0.95].map((t) => {
      const q = pinballArgmin(d, t);
      return [q, r(d.filter((v) => v <= q).length / d.length, 3)];
    });
    expect(rows).toEqual([
      [6, 0.525],
      [10, 0.76],
      [15, 0.905],
      [17, 0.95],
    ]);
  });

  it("conformal coverage study", () => {
    expect(CF).toEqual({ mu: 20, k: 5, alpha: 0.2 });
    expect(r(Math.sqrt(20 + 400 / 5), 1)).toBe(10);
    expect(r(nbCover(...poissonInterval()), 3)).toBe(0.488);
    const rows = [9, 39, 199].map((n) => {
      const s = conformalStudy(n, CF_REPS, CF_SEED);
      return [r(s.mean, 3), r(s.low, 3), r(s.width, 1)];
    });
    expect(rows).toEqual([
      [0.816, 0.254, 27],
      [0.819, 0.121, 25.6],
      [0.82, 0.005, 25.3],
    ]);
  });
});

describe("fc-promotions", () => {
  it("the hand-worked promo", () => {
    const e = promoEffect(0.25, 0.4, 3);
    expect([Math.round(e.lift), Math.round(e.dip), Math.round(e.net), Math.round(e.profit)]).toEqual([120, 48, 72, -5240]);
    expect(e.weeks.slice(0, 7).map(Math.round)).toEqual([100, 100, 220, 84, 84, 84, 100]);
    expect(e.promoMargin).toBe(30);
    expect(220 * 30 - 8000 - 48 * 80).toBe(-5240);
    expect(r(772 / 7, 1)).toBe(110.3);
    expect(r(0.75 ** -2.74, 2)).toBe(2.2);
  });

  it("the promo explorer", () => {
    const at = (d: number, p: number) => promoEffect(d, p, 3);
    expect(Math.round(at(0.25, 0).profit)).toBe(-1400);
    expect([Math.round(at(0.1, 0).lift), Math.round(at(0.1, 0).profit)]).toEqual([33, 9]);
    expect(Math.round(at(0.05, 0).profit)).toBe(57);
    expect([Math.round(at(0.1, 0.4).dip), Math.round(at(0.1, 0.4).profit)]).toEqual([13, -1063]);
    expect([Math.round(at(0.4, 0.4).lift), Math.round(at(0.4, 0.4).profit), at(0.4, 0.4).promoMargin]).toEqual([306, -17777, 0]);
    expect(Math.round(promoEffect(0.25, 0.4, 1).profit)).toBe(-5240);
    // No-dip predict: 120 extra at ₹30 against ₹5,000 of margin given up
    expect(120 * 30 - 100 * 50).toBe(-1400);
    expect(400 * 0.8 - 260).toBe(60);
  });

  it("the exercises", () => {
    expect(r(8000 / 30 - 100, 1)).toBe(166.7);
    expect(r(100 + (6 * 72) / 52, 1)).toBe(108.3);
    expect(r(Math.log(2.2) / Math.log(1 / 0.75), 2)).toBe(2.74);
    expect(r(0.85 ** -2.74, 2)).toBe(1.56);
    expect(Math.round(promoLift(0.15))).toBe(56);
  });

  it("the promo forecasting study", () => {
    const s = promoStudy().map((x) => [x.model, r(x.promoWape, 3), r(x.postBias, 3), r(x.plainBias, 3)]);
    expect(s).toEqual([
      ["history", 0.453, 0.2, 0.053],
      ["depth", 0.062, 0.097, -0.04],
      ["dip", 0.062, -0.005, 0.001],
    ]);
    const ex = promoExample();
    expect(ex.sku.depth.slice(78).filter((d) => d > 0).length).toBeGreaterThan(0);
  });
});

describe("fc-deep", () => {
  it("scaling and tokens by hand", () => {
    expect([1, 3, 2, 2].map((v) => v / 2)).toEqual([0.5, 1.5, 1, 1]);
    expect([1800, 2200, 2100, 1900].map((v) => v / 2000)).toEqual([0.9, 1.1, 1.05, 0.95]);
    const t = tokenize([31, 44, 38, 52, 47, 35, 40, 49], 0.1);
    expect(t.scale).toBe(42);
    expect(t.scaled.map((v) => r(v, 3))).toEqual([0.738, 1.048, 0.905, 1.238, 1.119, 0.833, 0.952, 1.167]);
    expect(t.tokens).toEqual([7, 10, 9, 12, 11, 8, 10, 12]);
    expect(t.back.slice(0, 4).map((v) => r(v, 1))).toEqual([29.4, 42, 37.8, 50.4]);
    expect(r(t.maxErr, 1)).toBe(2);
  });

  it("one DeepAR-style step", () => {
    const g = fitGlobal();
    expect(g.coef.map((v) => r(v, 3))).toEqual([0.428, 0.596, -0.023]);
    expect(r(g.sd, 3)).toBe(0.158);
    expect(g.rows).toBe(11600);
    // The hand step with the rounded coefficients
    const m1 = 0.428 + 0.596 * 1.25 - 0.023 * 1.3;
    expect([r(m1, 3), r(m1 * 40, 1)]).toEqual([1.143, 45.7]);
    expect(r(0.596 * 1.25, 3)).toBe(0.745);
    const d1 = 1.143 + 0.158;
    expect([r(d1, 3), Math.round(d1 * 40)]).toEqual([1.301, 52]);
    expect(r(0.428 + 0.596 * 1.301 - 0.023 * 1.25, 2)).toBe(1.17);
    expect(Math.round(40 * (0.428 + 0.596 * 1.301 - 0.023 * 1.25))).toBe(47);
    expect(Math.round(40 * (0.428 + 0.596 * 1.143 - 0.023 * 1.25))).toBe(43);
    // The fitted model's long-run level is the series mean
    expect(r(g.coef[0] / (1 - g.coef[1] - g.coef[2]), 2)).toBe(1);
  });

  it("sample paths and lead-time P90", () => {
    const paths = deepPaths();
    expect(paths.length).toBe(DP.paths);
    const rows = [1, 2, 4, 8].map((L) => {
      const x = leadTimeP90(paths, L);
      return [r(x.paths, 1), r(x.sumOfQ, 1), r(x.indep, 1)];
    });
    expect(rows).toEqual([
      [53.7, 53.7, 53.6],
      [104.1, 106.5, 101.2],
      [199.8, 209, 190.2],
      [379, 410.1, 360],
    ]);
    expect(r(leadTimeP90(paths, 1).mean, 1)).toBe(45.7);
    expect(r(410.1 / 379 - 1, 2)).toBe(0.08);
    // Same model, fresh seed: same story
    const g = fitGlobal();
    const other = leadTimeP90(samplePaths(g.coef, g.sd, DP.last, DP.scale, 8, 4000, 99), 8);
    expect(other.sumOfQ).toBeGreaterThan(other.paths);
    expect(other.indep).toBeLessThan(other.paths);
  });

  it("global vs local", () => {
    const like = globalRuns("like").map((x) => [x.h, r(x.global, 3), r(x.local, 3), r(x.mean, 3)]);
    const unlike = globalRuns("unlike").map((x) => [x.h, r(x.global, 3), r(x.local, 3), r(x.mean, 3)]);
    expect(like).toEqual([
      [8, 0.135, 0.219, 0.185],
      [13, 0.131, 0.159, 0.175],
      [26, 0.128, 0.139, 0.168],
      [52, 0.129, 0.133, 0.168],
    ]);
    expect(unlike).toEqual([
      [8, 0.07, 0.1, 0.126],
      [13, 0.073, 0.079, 0.136],
      [26, 0.073, 0.059, 0.141],
      [52, 0.079, 0.055, 0.157],
    ]);
  });

  it("the exercises", () => {
    expect([4, 6, 5, 5].map((v) => v / 5)).toEqual([0.8, 1.2, 1, 1]);
    expect(Math.round(21 / 16 / 0.1)).toBe(13);
    expect(r(13 * 0.1 * 16, 1)).toBe(20.8);
    const z = normalQuantile(0.9);
    expect(r(100 + z * Math.sqrt(300), 1)).toBe(122.2);
    expect(r(2 * (50 + z * 10), 1)).toBe(125.6);
    expect(r(100 + z * Math.sqrt(200), 1)).toBe(118.1);
  });
});

describe("fc-safety-stock", () => {
  it("the hand-worked newsvendor", () => {
    const { price, cost, salvage, demand } = NV_HAND;
    expect(r(criticalRatio(price, cost, salvage), 3)).toBe(0.643);
    expect([80, 90, 100, 110, 120].map((q) => r(tableProfit(q, demand, price, cost, salvage), 1))).toEqual([14400, 15920, 16880, 16720, 16000]);
    expect(r(0.7 * 180 - 0.3 * 100, 1)).toBe(96);
    expect(r(0.3 * 180 - 0.7 * 100, 1)).toBe(-16);
  });

  it("the hand-worked safety stock", () => {
    const z = normalQuantile(SS.target);
    expect(r(z, 3)).toBe(1.645);
    expect(SS.sigma * Math.sqrt(SS.L)).toBe(20);
    expect(r(z * 20, 1)).toBe(32.9);
    expect(r(leadTimeSd(1, 4, 0.5) ** 2, 2)).toBe(8.25);
    expect(r(leadTimeSd(10, 4, 0.5), 1)).toBe(28.7);
    expect(r(ruleService(4, 0.5, 0.95), 3)).toBe(0.874);
    expect(r(z * leadTimeSd(10, 4, 0.5), 1)).toBe(47.2);
  });

  it("the newsvendor explorer", () => {
    const pmf = pmfArray(NV.mean, NV.k);
    expect(r(Math.sqrt(NV.mean + NV.mean ** 2 / NV.k), 0)).toBe(22);
    const run = (p: number, c: number, s: number) => {
      const cr = criticalRatio(p, c, s);
      const q = pmfQuantile(pmf, cr);
      return [r(cr, 3), q, Math.round(orderOutcome(q, pmf, p, c, s).profit), Math.round(orderOutcome(100, pmf, p, c, s).profit)];
    };
    expect(run(300, 120, 20)).toEqual([0.643, 107, 15620, 15511]);
    expect(run(300, 250, 20)).toEqual([0.179, 79, 3474, 2511]);
    expect(run(300, 120, 100).slice(0, 2)).toEqual([0.9, 129]);
    expect(run(500, 120, 20).slice(0, 3)).toEqual([0.792, 118, 34769]);
  });

  it("the lead-time explorer", () => {
    expect(r(leadTimeSd(10, 8, 0), 1)).toBe(28.3);
    expect(r(leadTimeSd(10, 8, 0.8), 1)).toBe(62.2);
    expect(r(ruleService(8, 0.8, 0.95), 3)).toBe(0.773);
    expect(r(ruleService(6, 0, 0.95), 3)).toBe(0.95);
  });

  it("the policy study", () => {
    const fmt = (s: number) => policyStudy(s).map((p) => [p.policy, Math.round(p.profit), p.units, r(p.fill, 3)]);
    expect(fmt(0.25)).toEqual([
      ["mean", 959432, 12891, 0.778],
      ["p95", -453511, 26929, 0.978],
      ["cr", 1025760, 11074, 0.702],
      ["crPoisson", 994548, 12482, 0.761],
    ]);
    expect(r(1025760 / 959432 - 1, 2)).toBe(0.07);
    expect(r((994548 - 959432) / (1025760 - 959432), 2)).toBe(0.53);
    const zero = policyStudy(0);
    expect(Math.round(zero[1].profit)).toBe(-1194306);
    const high = policyStudy(0.75);
    expect(high.every((p) => p.profit > 0)).toBe(true);
    expect(high[2].units).toBeGreaterThan(high[0].units);
    const skus = seasonSkus();
    expect(r(skus.filter((s) => criticalRatio(s.price, s.cost, s.cost * 0.25) < 0.5).length / skus.length, 2)).toBe(0.56);
    expect(Math.round([...skus.map((s) => s.m)].sort((a, b) => a - b)[500])).toBe(8);
  });

  it("the exercises", () => {
    expect(criticalRatio(250, 100, 0)).toBe(0.6);
    expect(r(1.645 * 8 * 3, 1)).toBe(39.5);
    expect(r(leadTimeSd(10, 2, 0.5), 1)).toBe(17.3);
    expect(r(ruleService(2, 0.5, 0.95), 2)).toBe(0.91);
    expect(r(Math.exp(-0.5) * 1.5, 3)).toBe(0.91);
    expect(r((1 - Math.exp(-0.5)) / 0.5, 3)).toBe(0.787);
    expect(criticalRatio(200, 150, 0)).toBe(0.25);
    expect(0.5 * 50 - 0.5 * 150).toBe(-50);
  });
});

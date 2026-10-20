import { describe, expect, it } from "vitest";
import {
  acf,
  acfBand,
  alphaStar,
  alphaStudy,
  arForecast,
  arSd,
  baseline,
  bestAlpha,
  bias,
  constantScores,
  decompose,
  fanPaths,
  HAND_SES,
  HAND_WEEKS,
  halfLife,
  holdoutStudy,
  lagPairs,
  mae,
  maseScale,
  mean,
  noiseStudy,
  pacf,
  pacfFromAcf,
  pairCorr,
  poissonPmf,
  quantile,
  rollingOrigin,
  rwSd,
  sd,
  ses,
  sesWeight,
  simulate,
  storeSeries,
  theoryAcf,
  wape,
  weeklySeries,
  weeksTo90,
  wiggle,
} from "@/lib/sim/forecast";
import { ACF_LAGS, DC_WINDOWS, HO_SEED, HO_STORES, NZ_SEED, NZ_SERIES } from "@/components/viz/ForecastBasics";
import { AP_LAGS, AP_N, AP_SEED, AS_N, AS_QS, AS_REPS, AS_SEED, FF, FF_SHOW } from "@/components/viz/Smoothing";

const r = (v: number, d: number) => Number(v.toFixed(d));
const pct = (v: number, d = 1) => r(v * 100, d);

describe("fc-anatomy", () => {
  const y = storeSeries();
  const w1 = HAND_WEEKS.slice(0, 7);
  const w2 = HAND_WEEKS.slice(7);

  it("the hand-worked decomposition", () => {
    expect([w1, w2].map((w) => w.reduce((s, v) => s + v, 0))).toEqual([2800, 2870]);
    expect([mean(w1), mean(w2)]).toEqual([400, 410]);
    expect(r(495 / 425 - 1, 3)).toBe(0.165);
    const idx = w1.map((v, i) => (v - 400 + w2[i] - 410) / 2);
    expect(idx).toEqual([-37.5, -52.5, -30, -22.5, 12.5, 82.5, 47.5]);
    expect(idx.reduce((s, v) => s + v, 0)).toBe(0);
    expect(495 - 410 - 82.5).toBe(2.5);
    expect(355 - 410 + 52.5).toBe(-2.5);
    expect(82.5 - 12.5).toBe(70);
    expect(420 + 82.5).toBe(502.5);
    expect(y.slice(14, 21)).toEqual([398, 364, 409, 382, 449, 512, 480]);
    expect(420 - 52.5).toBe(367.5);
    expect(364 - 367.5).toBe(-3.5);
  });

  it("the hand-worked lag-7 autocorrelation", () => {
    expect(mean(HAND_WEEKS)).toBe(405);
    const d = HAND_WEEKS.map((v) => v - 405);
    expect(d).toEqual([-45, -55, -35, -25, 5, 75, 45, -30, -50, -25, -20, 20, 90, 50]);
    expect(d.reduce((s, v) => s + v * v, 0)).toBe(30000);
    expect(d.slice(7).reduce((s, v, i) => s + v * d[i], 0)).toBe(14575);
    expect(r(acf(HAND_WEEKS, 7)[7], 3)).toBe(0.486);
    expect(r(pairCorr(lagPairs(HAND_WEEKS, 7)), 3)).toBe(0.995);
  });

  it("the decomposer at each window", () => {
    const rows = DC_WINDOWS.map((w) => {
      const d = decompose(y, w);
      const rem = d.remainder.filter((v): v is number => v !== null);
      return [w, r(d.index[5], 1), r(wiggle(d.trend), 2), r(sd(rem), 2)];
    });
    expect(rows).toEqual([
      [3, 34.1, 28.66, 11.45],
      [5, 65.7, 15.94, 11.35],
      [7, 81.8, 2.56, 11.69],
      [9, 90.9, 8.68, 12.13],
      [14, 82.5, 0.84, 12.1],
      [28, 82.2, 0.4, 12.69],
    ]);
  });

  it("the ACF explorer", () => {
    const a = acf(y, ACF_LAGS);
    expect([1, 3, 7, 14, 21, 28].map((k) => r(a[k], 3))).toEqual([0.676, 0.111, 0.852, 0.741, 0.625, 0.534]);
    expect(Math.max(...a.slice(1))).toBe(a[7]);
    expect(lagPairs(y, 7)).toHaveLength(105);
    expect(r(pairCorr(lagPairs(y, 7)), 3)).toBe(0.962);
    for (const k of [14, 21, 28]) expect(r(pairCorr(lagPairs(y, k)), 2)).toBeGreaterThanOrEqual(0.95);
    const rem = decompose(y, 7).remainder.filter((v): v is number => v !== null);
    const ar = acf(rem, ACF_LAGS);
    expect(r(ar[7], 3)).toBe(-0.118);
    expect(r(ar[1], 3)).toBe(-0.344);
    expect(r(acfBand(rem.length), 3)).toBe(0.19);
    expect(r(acfBand(112), 3)).toBe(0.185);
  });

  it("the pure-noise study", () => {
    const ns = noiseStudy(NZ_SERIES, 112, ACF_LAGS, NZ_SEED);
    expect(r(sd(ns.r7), 4)).toBe(0.0909);
    expect(r(1 / Math.sqrt(112), 4)).toBe(0.0945);
    expect(pct(ns.share)).toBe(3.2);
    expect(pct(ns.anyShare)).toBe(56.8);
    expect(NZ_SERIES * ACF_LAGS).toBe(14000);
    expect(r(1 - 0.95 ** 28, 3)).toBe(0.762);
  });

  it("the exercises and the Depth notes", () => {
    expect(r(1600 / 7, 1)).toBe(228.6);
    expect([210, 190, 200, 205, 230, 290, 275].reduce((s, v) => s + v, 0)).toBe(1600);
    expect(r((82 + 88 + 77) / 3, 1)).toBe(82.3);
    expect(r(1.96 / Math.sqrt(365), 3)).toBe(0.103);
    const ex = [2, 4, 6, 4, 2, 4, 6, 4];
    expect([1, 2, 4].map((k) => acf(ex, k)[k])).toEqual([0, -0.75, 0.5]);
    expect(r((-2 / 7 + 6 / 49) / (6 / 7), 2)).toBe(-0.19);
  });
});

describe("fc-baselines", () => {
  const y = storeSeries();
  const w1 = HAND_WEEKS.slice(0, 7);
  const w2 = HAND_WEEKS.slice(7);
  const w3 = y.slice(14, 21);

  it("the hand-worked backtest of week 3", () => {
    expect(w3.reduce((s, v) => s + v, 0)).toBe(2994);
    const naive = baseline("naive", y, 14, 7);
    const snaive = baseline("snaive", y, 14, 7);
    expect(naive).toEqual(new Array(7).fill(455));
    expect(snaive).toEqual(w2);
    expect(naive.map((f, i) => f - w3[i])).toEqual([57, 91, 46, 73, 6, -57, -25]);
    expect(snaive.map((f, i) => f - w3[i])).toEqual([-23, -9, -29, 3, -24, -17, -25]);
    expect(pct(wape(w3, naive), 2)).toBe(11.86);
    expect(pct(wape(w3, snaive), 2)).toBe(4.34);
    expect(pct(bias(w3, naive), 2)).toBe(6.38);
    expect(pct(bias(w3, snaive), 2)).toBe(-4.14);
    expect(w2.map((v, i) => Math.abs(v - w1[i]))).toEqual([15, 5, 10, 5, 15, 15, 5]);
    expect(maseScale(HAND_WEEKS)).toBe(10);
    expect(r(mae(w3, naive), 2)).toBe(50.71);
    expect(r(mae(w3, snaive), 2)).toBe(18.57);
    expect(r(mae(w3, naive) / 10, 2)).toBe(5.07);
    expect(r(mae(w3, snaive) / 10, 2)).toBe(1.86);
  });

  it("rolling origin on the Pune store", () => {
    const res = Object.fromEntries((["naive", "snaive", "mean28", "weekday4"] as const).map((m) => [m, rollingOrigin(y, m)]));
    expect([pct(res.snaive.wape), pct(res.snaive.bias), r(res.snaive.mase, 2)]).toEqual([3.1, -1.9, 0.93]);
    expect([pct(res.naive.wape), pct(res.naive.bias), r(res.naive.mase, 2)]).toEqual([12.7, 10.4, 3.75]);
    expect(pct(res.mean28.wape)).toBe(8.3);
    expect([pct(res.weekday4.wape), pct(res.weekday4.bias)]).toEqual([4.7, -4.6]);
    const folds = res.snaive.folds.map((f) => pct(f.wape));
    expect([Math.min(...folds), Math.max(...folds)]).toEqual([2.3, 3.8]);
    expect(r(res.snaive.scale, 2)).toBe(17.41);
    expect(Math.min(...Object.values(res).map((x) => x.wape))).toBe(res.snaive.wape);
  });

  it("the slow mover", () => {
    expect([r(constantScores(0).wape, 6), constantScores(0).bias]).toEqual([1, -1]);
    expect(pct(constantScores(0.6).wape)).toBe(109.8);
    expect(r(constantScores(0.6).rmse, 3)).toBe(0.775);
    expect(r(constantScores(0).rmse, 3)).toBe(0.98);
    expect(pct(constantScores(1).wape)).toBe(116.3);
    expect(r(poissonPmf(0, 0.6), 3)).toBe(0.549);
    expect(r(Math.log(2), 3)).toBe(0.693);
  });

  it("the holdout study", () => {
    const hs = holdoutStudy(HO_STORES, HO_SEED);
    expect(r(hs.singleSpread * 100, 2)).toBe(0.94);
    expect(r(hs.rollingSpread * 100, 2)).toBe(0.36);
    expect(pct(hs.singleWrong)).toBe(10.3);
    expect(pct(hs.rollingWrong)).toBe(0);
    expect([pct(hs.expected.a[0]), pct(hs.expected.a[1]), pct(hs.expected.b[1])]).toEqual([3.4, 3.6, 5.1]);
    expect(Math.abs(mean(hs.singleErr))).toBeLessThan(0.001);
    expect(Math.abs(mean(hs.rollingErr))).toBeLessThan(0.001);
  });

  it("the exercises", () => {
    expect(pct(wape([8, 12, 10], [10, 10, 10]))).toBe(13.3);
    expect(bias([8, 12, 10], [10, 10, 10])).toBe(0);
    expect(pct(wape([1, 100], [3, 98]), 2)).toBe(3.96);
    expect(((2 / 1 + 2 / 100) / 2) * 100).toBe(101);
    expect(r(0.8 * 17.41, 1)).toBe(13.9);
  });
});

describe("fc-ets", () => {
  const wk = weeklySeries();

  it("the hand-worked smoothing", () => {
    const s = ses(HAND_SES, 0.3);
    expect(s.level.map((v) => r(v, 2))).toEqual([2800, 2818, 2806.6, 2714.62, 2656.23, 2603.36]);
    expect(r(0.3 * (2500 - 2806.6), 2)).toBe(-91.98);
    expect(r(1 - 0.7 ** 3, 3)).toBe(0.657);
    const wts = [0, 1, 2, 3, 4].map((j) => r(sesWeight(0.3, j), 4));
    expect(wts).toEqual([0.3, 0.21, 0.147, 0.1029, 0.072]);
    expect(r(0.7 ** 5, 3)).toBe(0.168);
    const unrolled = [0, 1, 2, 3, 4].reduce((acc, j) => acc + sesWeight(0.3, j) * HAND_SES[5 - j], 0) + 0.7 ** 5 * HAND_SES[0];
    expect(r(unrolled, 2)).toBe(2603.36);
    expect(r(halfLife(0.3), 2)).toBe(1.94);
  });

  it("the explorer and the year's best α", () => {
    expect(bestAlpha(wk)).toBe(0.42);
    expect(r(ses(wk, 0.42).rmse, 1)).toBe(102.7);
    const row = (a: number) => [r(ses(wk, a).rmse, 1), weeksTo90(a)];
    expect(row(0.3)).toEqual([104.1, 7]);
    expect(row(0.1)).toEqual([121.1, 22]);
    expect(row(1)).toEqual([120.8, 1]);
    expect(row(0.05)[0]).toBe(140.6);
    expect([r(ses(wk, 0.4).rmse, 1), r(ses(wk, 0.45).rmse, 1)]).toEqual([102.7, 102.7]);
    expect([r(ses(wk, 0.3).rmse, 1), r(ses(wk, 0.5).rmse, 1)]).toEqual([104.1, 103.1]);
    expect(Math.round(ses(wk, 0.1).level[32])).toBe(2711);
  });

  it("the α study against the Kalman formula", () => {
    const res = alphaStudy(AS_QS, AS_REPS, AS_N, AS_SEED);
    expect(res.map((x) => r(x.fitted, 3))).toEqual([0.103, 0.277, 0.61, 0.913]);
    expect(res.map((x) => r(x.theory, 3))).toEqual([0.095, 0.27, 0.618, 0.916]);
    for (const x of res) expect(x.spread).toBeGreaterThan(0.035);
    for (const x of res) expect(x.spread).toBeLessThan(0.07);
    expect(r(alphaStar(1), 3)).toBe(r((Math.sqrt(5) - 1) / 2, 3));
  });

  it("the exercises", () => {
    expect(2600 + 0.25 * (2400 - 2600)).toBe(2550);
    expect(r(sesWeight(0.4, 3), 4)).toBe(0.0864);
    expect(r(halfLife(0.2), 2)).toBe(3.11);
    expect(weeksTo90(0.3)).toBe(7);
    expect(r(Math.log(0.1) / Math.log(0.7), 2)).toBe(6.46);
    expect(r(0.7 ** 7, 3)).toBe(0.082);
    expect(r(10 / 0.3, 1)).toBe(33.3);
    expect(r(alphaStar(0.25), 2)).toBe(0.39);
    // Steady-state SES lags a trend by b/α.
    const trend = Array.from({ length: 300 }, (_, t) => 1000 + 10 * t);
    const s = ses(trend, 0.3);
    expect(r(trend[299] - s.level[298], 1)).toBe(33.3);
  });
});

describe("fc-arima", () => {
  it("the hand-worked memory", () => {
    expect([1, 2, 3, 4].map((h) => r(arForecast(2800, 0.6, 3000, h), 1))).toEqual([2920, 2872, 2843.2, 2825.9]);
    expect(r(200 * 0.6 ** 13, 1)).toBe(0.3);
    expect((theoryAcf("ar1", 0.6, 3) as number[]).map((v) => r(v, 3))).toEqual([0.6, 0.36, 0.216]);
    expect(pacfFromAcf([1, 0.6, 0.36, 0.216]).map((v) => r(v, 6))).toEqual([0.6, 0, 0]);
    expect(theoryAcf("ma1", 0.5, 2)).toEqual([0.4, 0]);
    expect(r(rwSd(100, 13), 0)).toBe(361);
    expect(13 * 200).toBe(2600);
  });

  it("the ACF and PACF lab", () => {
    expect(r(acfBand(AP_N), 2)).toBe(0.14);
    const at = (p: "ar1" | "ma1" | "rw" | "diff", c: number) => {
      const y = simulate(p, c, AP_N, AP_SEED);
      return { r: acf(y, AP_LAGS).slice(1), p: pacf(y, AP_LAGS) };
    };
    const ar = at("ar1", 0.6);
    expect([r(ar.r[0], 2), r(ar.r[1], 2), r(ar.p[1], 2)]).toEqual([0.64, 0.4, -0.01]);
    for (const v of ar.p.slice(1)) expect(Math.abs(v)).toBeLessThan(acfBand(AP_N));
    const ar9 = at("ar1", 0.9);
    expect([r(ar9.r[0], 2), r(ar9.r[1], 2)]).toEqual([0.89, 0.78]);
    const arn = at("ar1", -0.6);
    expect([r(arn.r[0], 2), r(arn.r[1], 2)]).toEqual([-0.58, 0.38]);
    const ma = at("ma1", 0.6);
    expect([r(ma.r[0], 2), r(ma.p[1], 2)]).toEqual([0.49, -0.21]);
    expect(r(theoryAcf("ma1", 0.6, 1)[0] as number, 2)).toBe(0.44);
    for (const v of ma.r.slice(1)) expect(Math.abs(v)).toBeLessThan(acfBand(AP_N));
    const rw = at("rw", 0.6);
    expect([r(rw.r[0], 2), r(rw.r[1], 2), r(rw.r[11], 2)]).toEqual([0.96, 0.92, 0.59]);
    const df = at("diff", 0.6);
    expect(r(df.r[0], 2)).toBe(0.05);
    for (const v of df.r) expect(Math.abs(v)).toBeLessThan(acfBand(AP_N));
  });

  it("the forecast fan", () => {
    const sim = (phi: number) => {
      const P = fanPaths(phi, FF.mu, FF.last, FF.sigma, FF.H, FF.paths, FF.seed);
      return { sd: FF_SHOW.map((h) => Math.round(sd(P.map((p) => p[h - 1])))), mid: Math.round(quantile(P.map((p) => p[FF.H - 1]), 0.5)) };
    };
    expect(sim(FF.phi)).toEqual({ sd: [102, 129, 125, 124], mid: 2803 });
    expect(sim(1)).toEqual({ sd: [102, 206, 365, 507], mid: 3003 });
    expect(FF_SHOW.map((h) => Math.round(arSd(FF.phi, FF.sigma, h)))).toEqual([100, 124, 125, 125]);
    expect(FF_SHOW.map((h) => Math.round(rwSd(FF.sigma, h)))).toEqual([100, 200, 361, 510]);
    expect(r(FF.sigma / Math.sqrt(1 - FF.phi ** 2), 0)).toBe(125);
  });

  it("the exercises", () => {
    expect([1, 2].map((h) => arForecast(100, 0.5, 140, h))).toEqual([120, 110]);
    expect(r(theoryAcf("ma1", 0.8, 1)[0] as number, 3)).toBe(0.488);
    expect(r(50 / Math.sqrt(1 - 0.64), 1)).toBe(83.3);
    expect(theoryAcf("ma1", 1, 1)[0]).toBe(0.5);
    expect(r(1.645 * rwSd(100, 13), 0)).toBe(593);
    expect(r(1.645 * 125, 0)).toBe(206);
  });
});

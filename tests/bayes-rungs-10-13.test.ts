import { describe, expect, it } from "vitest";
import { betaCdf, betaInterval, normalNormal } from "@/lib/sim/bayes";
import {
  AB,
  abDraws,
  abSummary,
  autocorr,
  avg,
  avgJump,
  bag,
  bagStudy,
  ballFraction,
  corr,
  diagChains,
  erf,
  ess,
  essChains,
  gridPoints,
  handWalk,
  hmcRun,
  leapfrogLimit,
  logEndcap,
  metropolis,
  MMM_TRUTH,
  mmmOLS,
  mmmSample,
  mmmStats,
  mmmStudy,
  mmmWorld,
  peekingStudy,
  peekPaths,
  probBBeatsA,
  probBBeatsANormal,
  quantile,
  rhat,
  rwRun,
  share,
  stepStudy,
} from "@/lib/sim/mcmc";
import { mulberry32 } from "@/lib/sim/rng";
import { BAG_SEED, MW_SEED, MW_STEPS, MW_WARMUP, RB_ITERS, RB_LEAPS, RB_RW_STEP, SS_STEPS, STUDY_SIZES } from "@/components/viz/Sampling";
import { AB_DRAWS, AB_SEED, PEEK_LOOKS, PEEK_SEED, PEEK_TESTS } from "@/components/viz/BayesAB";
import { MMM_SEED, MS_SEED, MS_WORLDS } from "@/components/viz/MMMBridge";

const r = (v: number, d: number) => Number(v.toFixed(d));
const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

describe("Rung 10: why sample", () => {
  it("the exact endcap answers", () => {
    expect(5 / 20).toBe(0.25);
    expect(r(1 - betaCdf(0.3, 5, 15), 3)).toBe(0.282);
    expect(betaInterval(5, 15).map((v) => r(v, 3))).toEqual([0.11, 0.419]);
    expect(r(Math.sqrt((5 * 15) / (20 ** 2 * 21)), 4)).toBe(0.0945);
    expect(r(0.0945 / Math.sqrt(4000), 4)).toBe(0.0015);
  });

  it("grid sizes", () => {
    expect([1, 2, 3].map((d) => gridPoints(d))).toEqual([100, 10_000, 1_000_000]);
    expect(Math.log10(gridPoints(42))).toBeCloseTo(84, 10);
    expect(Math.log10(1e84 / 1e9)).toBeCloseTo(75, 10);
    expect(50 ** 6).toBe(15_625_000_000);
  });

  it("the ten-draw bag by hand", () => {
    const ten = bag(10, 5).map((v) => r(v, 2));
    expect(ten).toEqual([0.21, 0.17, 0.26, 0.2, 0.34, 0.22, 0.38, 0.32, 0.38, 0.23]);
    expect(r(avg(ten), 3)).toBe(0.271);
    expect(share(ten, (v) => v > 0.3)).toBe(0.4);
    expect(ten.slice(0, 3).map((v) => r(120 * v, 1))).toEqual([25.2, 20.4, 31.2]);
    expect(r(120 * 0.271, 1)).toBe(32.5);
    expect(r(Math.sqrt((0.282 * 0.718) / 10), 3)).toBe(0.142);
    expect(r(Math.sqrt((0.282 * 0.718) / 4000), 4)).toBe(0.0071);
  });

  it("the SampleBag visual at 10, 100 and 4,000 draws", () => {
    const all = bag(4000, BAG_SEED);
    const at = (n: number) => all.slice(0, n);
    expect(share(at(10), (v) => v > 0.3).toFixed(3)).toBe("0.300");
    expect(share(at(100), (v) => v > 0.3).toFixed(3)).toBe("0.220");
    expect(avg(all).toFixed(3)).toBe("0.249");
    expect(share(all, (v) => v > 0.3).toFixed(3)).toBe("0.281");
    expect([quantile(all, 0.05), quantile(all, 0.95)].map((v) => v.toFixed(3))).toEqual(["0.110", "0.417"]);
  });

  it("200 bags at each size: the spread shrinks like 1/√N", () => {
    const s = bagStudy(STUDY_SIZES, 200, 7);
    expect(s.map((x) => x.spread.toFixed(4))).toEqual(["0.1365", "0.0488", "0.0155", "0.0071"]);
    const p = 1 - betaCdf(0.3, 5, 15);
    expect(STUDY_SIZES.map((n) => r(Math.sqrt((p * (1 - p)) / n), 4))).toEqual([0.1423, 0.045, 0.0142, 0.0071]);
  });

  it("the ball in the cube, and exercises", () => {
    expect([2, 3, 5, 10].map((d) => r(ballFraction(d), d === 10 ? 4 : 3))).toEqual([0.785, 0.524, 0.164, 0.0025]);
    expect(ballFraction(20)).toBeCloseTo(2.46e-8, 9);
    expect(ballFraction(3)).toBeCloseTo(Math.PI / 6, 12);
    expect(share([52, 61, 47, 58, 66, 55, 49, 63], (v) => v > 60)).toBe(0.375);
    expect(r(avg([0.05, -0.01, 0.06, 0.02]), 3)).toBe(0.03);
    expect(0.25 / 0.01 ** 2).toBeCloseTo(2500, 6);
    const s = 10 / 1.645;
    expect(r(s * Math.SQRT2, 1)).toBe(8.6);
    expect([100 - 1.645 * s * Math.SQRT2, 100 + 1.645 * s * Math.SQRT2].map(Math.round)).toEqual([86, 114]);
  });
});

describe("Rung 11: MCMC", () => {
  it("five Metropolis steps by hand", () => {
    const steps = handWalk(0.5, [-0.1, -0.15, 0.05, -0.1, -0.05], [0.62, 0.35, 0.85, 0.41, 0.9]);
    expect(steps.map((s) => s.ratio.toFixed(2))).toEqual(["5.26", "3.47", "0.79", "0.75", "0.44"]);
    expect(steps.map((s) => s.to)).toEqual([0.4, 0.25, 0.25, 0.15, 0.15]);
    expect(steps.filter((s) => s.accept)).toHaveLength(3);
    expect(r(0.8 ** 4 * 1.2 ** 14, 2)).toBe(5.26);
    // The MAP of Beta(5, 15).
    expect(r(4 / 18, 3)).toBe(0.222);
  });

  it("the walker visual at three step sizes", () => {
    const run = (step: number) => {
      const c = metropolis(logEndcap, 0.5, step, MW_STEPS, mulberry32(MW_SEED));
      const kept = c.draws.slice(MW_WARMUP);
      return { acc: ((c.accepted / MW_STEPS) * 100).toFixed(1), mean: avg(kept).toFixed(3), ess: Math.round(ess(kept)) };
    };
    expect(run(0.3)).toEqual({ acc: "34.6", mean: "0.249", ess: 739 });
    expect(run(0.01)).toEqual({ acc: "96.5", mean: "0.254", ess: 15 });
    expect(run(3)).toEqual({ acc: "3.4", mean: "0.247", ess: 91 });
  });

  it("the step-size study", () => {
    const rows = stepStudy(SS_STEPS, 20, 4000, 5);
    expect(rows.map((x) => Math.round(x.accept * 100))).toEqual([97, 90, 69, 36, 12, 4]);
    expect(rows.map((x) => Math.round(x.ess))).toEqual([16, 94, 467, 778, 285, 90]);
  });

  it("four chains: healthy, timid, stopped too soon", () => {
    const d = (s: "healthy" | "timid" | "short") => {
      const ch = diagChains(s);
      return { rhat: rhat(ch).toFixed(3), ess: Math.round(essChains(ch)), means: ch.map((c) => avg(c)) };
    };
    const h = d("healthy");
    expect([h.rhat, h.ess]).toEqual(["1.004", 836]);
    const t = d("timid");
    expect([t.rhat, t.ess]).toEqual(["9.223", 14]);
    expect([Math.min(...t.means), Math.max(...t.means)].map((v) => v.toFixed(2))).toEqual(["0.13", "0.79"]);
    const s = d("short");
    expect([s.rhat, s.ess]).toEqual(["1.413", 31]);
  });

  it("the rolling ball against the random walk", () => {
    const h = hmcRun(0.15, RB_LEAPS, RB_ITERS, 4);
    expect(Math.round((h.accepted / RB_ITERS) * 100)).toBe(96);
    expect(h.divergences).toBe(0);
    expect(avgJump(h).toFixed(2)).toBe("1.87");
    expect(ess(h.xs)).toBeGreaterThanOrEqual(RB_ITERS);
    const rw = rwRun(RB_RW_STEP, RB_ITERS, 4);
    expect(avgJump(rw).toFixed(2)).toBe("0.20");
    expect(Math.round(ess(rw.xs))).toBe(10);
    expect(hmcRun(0.45, RB_LEAPS, RB_ITERS, 4).divergences).toBe(464);
    expect(hmcRun(0.4, RB_LEAPS, RB_ITERS, 4).divergences).toBe(0);
    expect(leapfrogLimit().toFixed(3)).toBe("0.447");
  });

  it("exercises", () => {
    const ratio = Math.exp(logEndcap(0.3) - logEndcap(0.2));
    expect(r(ratio, 2)).toBe(0.78);
    expect(r(0.875 ** 14, 4)).toBe(0.1542);
    const trace = [0.25, 0.31, 0.31, 0.22, 0.22, 0.22, 0.27, 0.27];
    expect(trace.filter((v, i) => v !== (i === 0 ? 0.25 : trace[i - 1])).length / trace.length).toBe(0.375);
    expect(Math.round(4000 / (1 + 2 * (0.9 / 0.1)))).toBe(211);
    // R-hat without splitting: W = 0.00333, B/n = 0.08.
    const W = (4 * 0.05 ** 2) / 3;
    expect(r(Math.sqrt((0.75 * W + 0.08) / W), 2)).toBe(4.97);
    expect([0.8, 0.99].map((rho) => r(leapfrogLimit(rho), 3))).toEqual([0.894, 0.2]);
  });

  it("ESS and autocorrelation behave on known cases", () => {
    const rng = mulberry32(1);
    const iid = Array.from({ length: 4000 }, () => rng());
    expect(ess(iid)).toBeGreaterThan(3400);
    expect(autocorr(iid, 0)).toBeCloseTo(1, 12);
  });
});

describe("Rung 12: Bayesian A/B testing", () => {
  it("the frequentist answer the meeting got", () => {
    const p = (48 + 63) / 2400;
    const z = (63 / 1200 - 48 / 1200) / Math.sqrt(p * (1 - p) * (2 / 1200));
    expect(r(z, 2)).toBe(1.46);
    expect(r(2 * (1 - Phi(z)), 3)).toBe(0.145);
    expect(r(1 - Phi(z), 3)).toBe(0.072);
    expect(r(Phi(z), 3)).toBe(0.928);
  });

  it("ten pairs by hand", () => {
    const d = abDraws(AB.buysA, AB.buysB, AB.visitors, 10, 24);
    const A = d.a.map((v) => r(v * 100, 1));
    const B = d.b.map((v) => r(v * 100, 1));
    expect(A).toEqual([5.2, 2.9, 4.3, 4.5, 4.9, 4.6, 4.7, 4.4, 3.6, 3.6]);
    expect(B).toEqual([4.4, 4.8, 5.6, 5.4, 5.7, 5.2, 6.2, 4.6, 6.1, 6.6]);
    expect(A.filter((a, i) => B[i] > a)).toHaveLength(9);
    expect(r(A.reduce((s, a, i) => s + Math.max(a - B[i], 0), 0) / 10, 2)).toBe(0.08);
    expect(r(A.reduce((s, a, i) => s + Math.max(B[i] - a, 0), 0), 1)).toBe(12.7);
  });

  it("the visual's numbers for the real test and the try-this settings", () => {
    const run = (v: number, a: number, b: number) => {
      const d = abDraws(a, b, v, AB_DRAWS, AB_SEED);
      const s = abSummary(d.a, d.b);
      return {
        p: (s.pBetter * 100).toFixed(1),
        exact: (probBBeatsA(1 + a, 1 + v - a, 1 + b, 1 + v - b) * 100).toFixed(1),
        lossB: (s.lossB * 100).toFixed(3),
        lossA: (s.lossA * 100).toFixed(2),
        lo: (s.liftLo * 100).toFixed(1),
        hi: (s.liftHi * 100).toFixed(1),
      };
    };
    expect(run(1200, 48, 63)).toEqual({ p: "92.4", exact: "92.7", lossB: "0.029", lossA: "1.26", lo: "-3.7", hi: "78.6" });
    const same = run(1200, 48, 48);
    expect([same.p, r(Number(same.lossB), 2), Number(same.lossA)]).toEqual(["49.5", 0.33, 0.32]);
    const big = run(4800, 192, 252);
    expect([big.p, big.lo, big.hi]).toEqual(["99.9", "12.1", "53.2"]);
    const small = run(300, 12, 16);
    expect([small.p, small.lo, small.hi]).toEqual(["77.3", "-26.3", "146.1"]);
  });

  it("peeking", () => {
    expect(PEEK_LOOKS.map((l) => (peekingStudy(l, PEEK_TESTS, PEEK_SEED) * 100).toFixed(1))).toEqual(["5.3", "11.7", "22.6"]);
    const paths = peekPaths(30, 3);
    const crossed = (looks: number) => {
      const days = new Set(Array.from({ length: looks }, (_, i) => Math.round(((i + 1) * 28) / looks)));
      return paths.filter((p) => p.some((v, i) => days.has(i + 1) && v > 0.95)).length;
    };
    expect([crossed(1), crossed(4), crossed(28)]).toEqual([1, 4, 7]);
  });

  it("the Normal approximation matches the exact thin bars", () => {
    expect(Math.abs(probBBeatsANormal(48, 63, 1200) - probBBeatsA(49, 1153, 64, 1138))).toBeLessThan(0.002);
  });

  it("exercises", () => {
    expect(r(31 / 502, 3)).toBe(0.062);
    const pairs = [[4.1, 4.6], [3.9, 3.7], [4.4, 5.0], [4.0, 4.8], [4.6, 4.2], [3.8, 4.9], [4.2, 4.5], [4.3, 4.4]];
    expect(pairs.filter(([a, b]) => b > a).length / 8).toBe(0.75);
    expect(r(pairs.reduce((s, [a, b]) => s + Math.max(a - b, 0), 0) / 8, 3)).toBe(0.075);
    expect(r(pairs.reduce((s, [a, b]) => s + Math.max(b - a, 0), 0) / 8, 3)).toBe(0.425);
    const p = 220 / 4000;
    const z = 0.01 / Math.sqrt(p * (1 - p) * (2 / 2000));
    expect(r(z, 2)).toBe(1.39);
    expect(r(Phi(z), 2)).toBe(0.92);
    expect(r(probBBeatsA(101, 1901, 121, 1881), 3)).toBe(0.917);
    const sk = normalNormal(2, 25, 30, 576, 1);
    expect(r(sk.weightOnData, 3)).toBe(0.042);
    expect(r(sk.mean, 1)).toBe(3.2);
  });
});

describe("Rung 13: the bridge to Bayesian MMM", () => {
  const d = mmmWorld(MMM_SEED);

  it("the four-week ridge by hand", () => {
    const tv = [4, 6, 8, 10];
    const search = [2, 3, 4, 5];
    const sales = [112, 118, 124, 130];
    for (const [bt, bs] of [[3, 0], [1.5, 3], [0, 6], [-1, 8], [1.4, 3.2]]) {
      expect(tv.map((t, i) => 100 + bt * t + bs * search[i])).toEqual(sales.map((v) => expect.closeTo(v, 9)));
    }
    expect(r((3 - 1.4) / 0.5, 1)).toBe(3.2);
    expect(share([1.1, 1.6, 0.9, 1.4, 1.3, 1.8, 1.2, 0.7, 1.5, 1.4], (v) => v > 1)).toBe(0.8);
  });

  it("North's least squares and the spend correlation", () => {
    expect(corr(d.tv, d.search).toFixed(2)).toBe("0.95");
    expect(mmmOLS(d).map((v) => v.toFixed(2))).toEqual(["-0.31", "4.02"]);
    const s = mmmStats(d);
    const det = s.tt * s.ss - s.ts ** 2;
    expect((MMM_TRUTH.sigma * Math.sqrt(s.ss / det)).toFixed(2)).toBe("1.49");
    expect((MMM_TRUTH.sigma * Math.sqrt(s.tt / det)).toFixed(2)).toBe("2.77");
    expect((-s.ts / Math.sqrt(s.tt * s.ss)).toFixed(2)).toBe("-0.95");
    const r2 = corr(d.tv, d.search) ** 2;
    expect((1 / (1 - r2)).toFixed(1)).toBe("9.4");
    expect(r(1 / 0.09 / (1 / 1.4886 ** 2), 0)).toBe(25);
  });

  it("the posterior under each prior", () => {
    const fit = (p: "flat" | "positive" | "lift") => {
      const f = mmmSample(d, p, MMM_SEED);
      const tv = f.chains.map((c) => c.tv);
      return {
        mean: avg(f.tv).toFixed(2),
        lo: quantile(f.tv, 0.05).toFixed(2),
        hi: quantile(f.tv, 0.95).toFixed(2),
        p1: (share(f.tv, (v) => v > 1) * 100).toFixed(1),
        p0: (share(f.tv, (v) => v < 0) * 100).toFixed(1),
        search: avg(f.search).toFixed(2),
        rhat: rhat(tv).toFixed(3),
        ess: Math.round(essChains(tv)),
        n: f.tv.length,
      };
    };
    expect(fit("flat")).toEqual({ mean: "-0.49", lo: "-2.88", hi: "1.92", p1: "15.3", p0: "63.2", search: "4.39", rhat: "1.013", ess: 181, n: 20000 });
    expect(fit("positive")).toMatchObject({ mean: "0.83", lo: "0.07", hi: "1.83", p1: "36.0", p0: "0.0", search: "2.01", rhat: "1.001" });
    expect(fit("lift")).toMatchObject({ mean: "1.29", lo: "0.84", hi: "1.74", p1: "85.3", search: "1.31", rhat: "1.003", ess: 2297 });
  });

  it("200 regions", () => {
    const s = mmmStudy(MS_WORLDS, MS_SEED);
    expect([s.ols.rmse, s.positive.rmse, s.lift.rmse].map((v) => v.toFixed(2))).toEqual(["1.35", "0.44", "0.10"]);
    expect((s.ols.negative * 100).toFixed(1)).toBe("13.5");
    expect(s.positive.negative + s.lift.negative).toBe(0);
  });

  it("exercises", () => {
    expect((3 - 2) / 0.5).toBe(2);
    expect(share([0.6, 1.2, 1.5, 0.9, 1.1, 1.7, 0.8, 1.3], (v) => v > 1)).toBe(0.625);
    expect(r(1 / (1 - 0.81), 2)).toBe(5.26);
    expect(r(Math.sqrt(1 / (1 - 0.81)), 1)).toBe(2.3);
    const c = normalNormal(1.4, 0.09, 0.5, 2.25, 1);
    expect(r(c.weightOnData, 3)).toBe(0.038);
    expect(r(c.mean, 2)).toBe(1.37);
    expect(r(Math.sqrt(c.variance), 2)).toBe(0.29);
    const draws = [[1.2, 2.9], [1.6, 2.1], [1.4, 2.6], [1.9, 1.7]];
    expect(draws.filter(([t, s]) => s > t).length / 4).toBe(0.75);
    expect(r(avg(draws.map(([t, s]) => s - t)), 2)).toBe(0.8);
  });
});

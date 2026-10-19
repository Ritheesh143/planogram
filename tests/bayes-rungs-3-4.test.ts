import { describe, expect, it } from "vitest";
import { betaCdf, betaInterval, betaPdf, binomialPmf, gammaInterval, gridPosterior, normalize } from "@/lib/sim/bayes";
import {
  BB_VISITORS,
  gridInterval,
  gridMean,
  pgData,
  PG_GRID,
  poissonGridPosterior,
  presetPrior,
  repeatWorlds,
  simulateEndcaps,
} from "@/lib/sim/bayesSim";
import { poissonLikelihood, poissonPmf } from "@/lib/sim/prob";

const LAMBDAS = [0.5, 1, 2, 4];
const DAYS = [0, 2, 1];
const r3 = (v: number) => Math.round(v * 1000) / 1000;

describe("Rung 3: a grid of hypotheses (hand numbers)", () => {
  const like = LAMBDAS.map((l) => poissonLikelihood(DAYS, l));

  it("likelihoods are e^(−3λ)λ³/2", () => {
    LAMBDAS.forEach((l, i) => expect(like[i]).toBeCloseTo((Math.exp(-3 * l) * l ** 3) / 2, 12));
    expect(like.map((v) => +v.toFixed(5))).toEqual([0.01395, 0.02489, 0.00992, 0.0002]);
  });

  it("flat prior: products, total, posterior and mean", () => {
    const prod = like.map((v) => 0.25 * v);
    expect(prod.map((v) => +v.toFixed(5))).toEqual([0.00349, 0.00622, 0.00248, 0.00005]);
    expect(+prod.reduce((a, b) => a + b, 0).toFixed(5)).toBe(0.01224);
    const post = gridPosterior([0.25, 0.25, 0.25, 0.25], like);
    expect(post.map(r3)).toEqual([0.285, 0.509, 0.203, 0.004]);
    expect(+gridMean(LAMBDAS, post).toFixed(2)).toBe(1.07);
  });

  it("the manager's hunch moves the answer", () => {
    const prior = [0.1, 0.1, 0.4, 0.4];
    const post = gridPosterior(prior, like);
    expect(post.map(r3)).toEqual([0.176, 0.314, 0.5, 0.01]);
    expect(+gridMean(LAMBDAS, post).toFixed(2)).toBe(1.44);
    const prod = like.map((v, i) => prior[i] * v);
    expect(prod.map((v) => +v.toFixed(6))).toEqual([0.001395, 0.002489, 0.003966, 0.000079]);
    expect(+prod.reduce((a, b) => a + b, 0).toFixed(6)).toBe(0.007929);
  });

  it("day by day equals all at once", () => {
    let belief = [0.25, 0.25, 0.25, 0.25];
    const steps: number[][] = [];
    for (const k of DAYS) {
      belief = gridPosterior(
        belief,
        LAMBDAS.map((l) => poissonPmf(k, l)),
      );
      steps.push(belief.map(r3));
    }
    expect(steps).toEqual([
      [0.538, 0.326, 0.12, 0.016],
      [0.301, 0.442, 0.239, 0.018],
      [0.285, 0.509, 0.203, 0.004],
    ]);
  });

  it("exercise numbers: two worlds, and day 4", () => {
    const a = poissonPmf(2, 1);
    const b = poissonPmf(2, 2);
    expect(+a.toFixed(3)).toBe(0.184);
    expect(+b.toFixed(3)).toBe(0.271);
    expect(r3(b / (a + b))).toBe(0.595);
    const after3 = gridPosterior([0.25, 0.25, 0.25, 0.25], like);
    const l4 = LAMBDAS.map((l) => poissonPmf(3, l));
    expect(l4.map((v) => +v.toFixed(4))).toEqual([0.0126, 0.0613, 0.1804, 0.1954]);
    const prod = after3.map((p, i) => p * l4[i]);
    expect(prod.map((v) => +v.toFixed(5))).toEqual([0.0036, 0.03118, 0.03655, 0.00078]);
    expect(+prod.reduce((s, v) => s + v, 0).toFixed(5)).toBe(0.07211);
    expect(normalize(prod).map(r3)).toEqual([0.05, 0.432, 0.507, 0.011]);
  });
});

describe("Rung 3: the visual and the simulation", () => {
  const summary = (preset: "flat" | "hunch" | "skeptical", extra: number) => {
    const post = poissonGridPosterior(PG_GRID, presetPrior(preset), pgData(extra));
    const [lo, hi] = gridInterval(PG_GRID, post, 0.9);
    return { mean: +gridMean(PG_GRID, post).toFixed(2), lo: +lo.toFixed(1), hi: +hi.toFixed(1) };
  };

  it("matches the readouts quoted in the lesson", () => {
    expect(summary("flat", 0)).toEqual({ mean: 1.33, lo: 0.5, hi: 2.6 });
    expect(summary("hunch", 0)).toEqual({ mean: 2, lo: 1.2, hi: 3 });
    expect(summary("skeptical", 0)).toEqual({ mean: 1, lo: 0.6, hi: 1.5 });
    expect(summary("flat", 27).mean).toBe(1.3);
    expect(summary("hunch", 27).mean).toBe(1.42);
    expect(summary("skeptical", 27).mean).toBe(1.21);
    const all = pgData(27);
    expect(all).toHaveLength(30);
    expect(+(all.reduce((a, b) => a + b, 0) / 30).toFixed(2)).toBe(1.27);
  });

  it("the flat-prior posterior is the Gamma(4, 3) shape", () => {
    const [lo, hi] = gammaInterval(4, 3, 0.9);
    expect(+lo.toFixed(2)).toBe(0.46);
    expect(+hi.toFixed(2)).toBe(2.58);
  });

  it("credible intervals are calibrated when the prior is right, and not when it's confidently wrong", () => {
    const count = (a: "matched" | "flat" | "wrong", d: number) => repeatWorlds(1000, a, d).filter((w) => w.covers).length;
    expect(count("matched", 3)).toBe(904);
    expect(count("flat", 3)).toBe(911);
    expect(count("wrong", 3)).toBe(67);
    expect(count("wrong", 30)).toBe(177);
  });
});

describe("Rung 4: Beta–Binomial", () => {
  it("prior, posterior, mean, interval and the decision probability", () => {
    const [plo, phi] = betaInterval(2, 8, 0.9);
    expect([r3(plo), r3(phi)]).toEqual([0.041, 0.429]);
    const [lo, hi] = betaInterval(5, 15, 0.9);
    expect([r3(lo), r3(hi)]).toEqual([0.11, 0.419]);
    expect(5 / 20).toBe(0.25);
    expect(+(1 - betaCdf(0.2, 5, 15)).toFixed(2)).toBe(0.67);
    expect(+(1 - betaCdf(0.2, 2, 8)).toFixed(2)).toBe(0.44);
  });

  it("shopper by shopper ends at (5, 15)", () => {
    expect(BB_VISITORS.reduce((s, v) => s + v, 0)).toBe(3);
    let a = 2;
    let b = 8;
    const path: string[] = [];
    for (const v of BB_VISITORS) {
      a += v;
      b += 1 - v;
      path.push(`(${a}, ${b})`);
    }
    expect(path).toEqual(["(2, 9)", "(3, 9)", "(3, 10)", "(3, 11)", "(3, 12)", "(4, 12)", "(4, 13)", "(4, 14)", "(5, 14)", "(5, 15)"]);
  });

  it("thin bars of prior × likelihood reproduce Beta(5, 15)", () => {
    const ps = Array.from({ length: 1000 }, (_, i) => 0.0005 + i * 0.001);
    const post = gridPosterior(
      ps.map((p) => betaPdf(p, 2, 8)),
      ps.map((p) => binomialPmf(3, 10, p)),
    );
    expect(+gridMean(ps, post).toFixed(3)).toBe(0.25);
  });

  it("prior strength and more shoppers, as in Try this", () => {
    const post = (s: number, k: number, n: number) => {
      const a = 0.2 * s + k;
      const b = 0.8 * s + n - k;
      return { a, b, mean: r3(a / (a + b)), int: betaInterval(a, b, 0.9).map(r3) };
    };
    expect(post(100, 3, 10)).toMatchObject({ a: 23, b: 87, mean: 0.209 });
    const weak = post(2, 3, 10);
    expect([+weak.a.toFixed(1), +weak.b.toFixed(1), weak.mean]).toEqual([3.4, 8.6, 0.283]);
    expect(post(10, 12, 40)).toMatchObject({ mean: 0.28, int: [0.182, 0.388] });
  });

  it("exercise numbers", () => {
    expect(r3(2 / 15)).toBe(0.133);
    expect(r3(23 / 110)).toBe(0.209);
    expect(r3(32 / 110)).toBe(0.291);
    expect(betaInterval(32, 78, 0.9).map(r3)).toEqual([0.222, 0.364]);
    expect(r3(2 / 3)).toBe(0.667);
    expect(r3(97 / 102)).toBe(0.951);
  });

  it("1,000 simulated endcaps: the posterior mean beats the raw rate and intervals cover ~90%", () => {
    const ten = simulateEndcaps(1000, 2, 8, 10, 9);
    expect(+(ten.rawError * 100).toFixed(1)).toBe(9.2);
    expect(+(ten.postError * 100).toFixed(1)).toBe(6.7);
    expect(+(ten.coverage * 100).toFixed(1)).toBe(89.9);
    const fifty = simulateEndcaps(1000, 2, 8, 50, 9);
    expect(+(fifty.rawError * 100).toFixed(1)).toBe(4.2);
    expect(+(fifty.postError * 100).toFixed(1)).toBe(3.9);
  });
});

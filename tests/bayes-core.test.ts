import { describe, expect, it } from "vitest";
import {
  betaCdf,
  betaInterval,
  betaPdf,
  binomialPmf,
  gammaCdf,
  gammaInterval,
  gammaPdf,
  grid,
  gridPosterior,
  logGamma,
  negBinomialPmf,
  normalNormal,
} from "@/lib/sim/bayes";
import { gamma, mulberry32, poisson } from "@/lib/sim/rng";

describe("Bayesian core", () => {
  it("logGamma matches factorials", () => {
    expect(Math.exp(logGamma(5))).toBeCloseTo(24, 9);
    expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 10);
  });

  it("densities integrate to one as sums of thin bars", () => {
    const xs = grid(0.0005, 0.9995, 1000);
    expect(xs.reduce((s, x) => s + betaPdf(x, 5, 15) * 0.001, 0)).toBeCloseTo(1, 3);
    const ls = grid(0.005, 39.995, 4000);
    expect(ls.reduce((s, x) => s + gammaPdf(x, 3, 0.5) * 0.01, 0)).toBeCloseTo(1, 3);
  });

  it("a grid posterior from a flat-ish Beta(2, 8) prior and 3 of 10 matches Beta(5, 15)", () => {
    const ps = grid(0.0005, 0.9995, 1000);
    const prior = ps.map((p) => betaPdf(p, 2, 8));
    const like = ps.map((p) => binomialPmf(3, 10, p));
    const post = gridPosterior(prior, like);
    ps.forEach((p, i) => expect(post[i] / 0.001).toBeCloseTo(betaPdf(p, 5, 15), 2));
  });

  it("CDFs and intervals agree with known values", () => {
    expect(betaCdf(0.5, 2, 2)).toBeCloseTo(0.5, 12);
    expect(betaCdf(0.3, 1, 1)).toBeCloseTo(0.3, 12);
    expect(gammaCdf(2, 1, 1)).toBeCloseTo(1 - Math.exp(-2), 12);
    const [lo, hi] = betaInterval(5, 15, 0.9);
    expect(betaCdf(lo, 5, 15)).toBeCloseTo(0.05, 8);
    expect(betaCdf(hi, 5, 15)).toBeCloseTo(0.95, 8);
    const [glo, ghi] = gammaInterval(15, 5, 0.9);
    expect(gammaCdf(glo, 15, 5)).toBeCloseTo(0.05, 8);
    expect(gammaCdf(ghi, 15, 5)).toBeCloseTo(0.95, 8);
  });

  it("the negative binomial is the gamma-Poisson mixture", () => {
    const r = 4;
    const beta = 2;
    let total = 0;
    let mean = 0;
    let sq = 0;
    for (let k = 0; k < 200; k++) {
      const p = negBinomialPmf(k, r, beta);
      total += p;
      mean += k * p;
      sq += k * k * p;
    }
    expect(total).toBeCloseTo(1, 10);
    expect(mean).toBeCloseTo(r / beta, 8);
    expect(sq - mean * mean).toBeCloseTo((r / beta) * (1 + 1 / beta), 8);
    const rng = mulberry32(3);
    const draws = Array.from({ length: 50000 }, () => poisson(rng, gamma(rng, r, 1 / beta)));
    const zeros = draws.filter((d) => d === 0).length / draws.length;
    expect(zeros).toBeCloseTo(negBinomialPmf(0, r, beta), 2);
  });

  it("normal-normal shrinkage is a precision-weighted average", () => {
    const post = normalNormal(50, 100, 30, 400, 2);
    // Prior precision 1/100, data precision 2/400 = 1/200: weights 2/3 and 1/3.
    expect(post.weightOnData).toBeCloseTo(1 / 3, 12);
    expect(post.mean).toBeCloseTo(50 * (2 / 3) + 30 * (1 / 3), 12);
    expect(post.variance).toBeCloseTo(1 / (1 / 100 + 1 / 200), 12);
  });
});

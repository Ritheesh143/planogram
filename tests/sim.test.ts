import { describe, expect, it } from "vitest";
import { BOOST_X, BOOST_Y } from "@/components/viz/BoostingByHand";
import { boost, predictAt, splitCandidates } from "@/lib/sim/boosting";
import { runMany } from "@/lib/sim/experiments";
import { countWorlds, normalQuantile, poissonLikelihood, poissonPmf, tQuantile } from "@/lib/sim/prob";
import { binomial, mulberry32 } from "@/lib/sim/rng";

describe("Keystone 1: counting worlds", () => {
  it("matches the hand count and the exact Bayes answer", () => {
    const w = countWorlds(1000, 0.01, 0.9, 0.05);
    expect([w.fraud, w.caught, w.missed, w.genuine, w.falseAlarms, w.clear]).toEqual([10, 9, 1, 990, 50, 940]);
    expect(w.posterior).toBeCloseTo(0.009 / 0.0585, 10);
  });

  it("agrees with brute-force simulation", () => {
    const rng = mulberry32(11);
    let flagged = 0;
    let fraudFlagged = 0;
    for (let i = 0; i < 400_000; i++) {
      const fraud = rng() < 0.01;
      if (rng() < (fraud ? 0.9 : 0.05)) {
        flagged++;
        if (fraud) fraudFlagged++;
      }
    }
    expect(fraudFlagged / flagged).toBeCloseTo(0.1538, 1);
  });
});

describe("Keystone 2: confidence intervals", () => {
  const opts = { trueLift: 5, noiseSd: 8, level: 0.95 };

  it("t-intervals cover about 95% even with 5 stores", () => {
    const ivs = runMany(mulberry32(3), 10_000, { ...opts, stores: 5 });
    const coverage = ivs.filter((i) => i.covers).length / ivs.length;
    expect(coverage).toBeGreaterThan(0.94);
    expect(coverage).toBeLessThan(0.96);
  });

  it("the 1.96 shortcut under-covers with 5 stores", () => {
    const ivs = runMany(mulberry32(4), 10_000, { ...opts, stores: 5, useZ: true });
    const coverage = ivs.filter((i) => i.covers).length / ivs.length;
    expect(coverage).toBeGreaterThan(0.86);
    expect(coverage).toBeLessThan(0.9);
  });

  it("uses accurate normal and t quantiles", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(tQuantile(0.975, 4)).toBeCloseTo(2.776, 1);
    expect(tQuantile(0.975, 19)).toBeCloseTo(2.093, 2);
  });
});

describe("Keystone 3: likelihood", () => {
  it("reproduces the hand-worked likelihood table", () => {
    const data = [0, 2, 1];
    expect(poissonLikelihood(data, 1)).toBeCloseTo(0.0249, 4);
    expect(poissonLikelihood(data, 0.5)).toBeCloseTo(0.0139, 4);
    expect(poissonLikelihood(data, 5)).toBeCloseTo(1.91e-5, 7);
  });

  it("peaks at the sample mean", () => {
    const data = [0, 2, 7];
    let best = 0;
    let bestL = -1;
    for (let l = 0.01; l < 10; l += 0.01) {
      const L = poissonLikelihood(data, l);
      if (L > bestL) [best, bestL] = [l, L];
    }
    expect(best).toBeCloseTo(3, 1);
  });

  it("Binomial(n, λ/n) approaches Poisson(λ) as n grows", () => {
    const rng = mulberry32(5);
    const draws = Array.from({ length: 20_000 }, () => binomial(rng, 1000, 2 / 1000));
    const share2 = draws.filter((d) => d === 2).length / draws.length;
    expect(share2).toBeCloseTo(poissonPmf(2, 2), 1);
  });
});

describe("Keystone 4: boosting by hand", () => {
  it("finds the hand-worked splits, leaves and errors", () => {
    const h = boost(BOOST_X, BOOST_Y, 2, 0.5);
    expect(h[0].pred[0]).toBe(28);
    expect(h[0].sse).toBe(1376);
    expect(h[1].stump).toMatchObject({ threshold: 47.5, left: -14, right: 14 });
    expect(h[1].sse).toBe(494);
    expect(h[2].stump).toMatchObject({ threshold: 62.5, left: -5.5, right: 11 });
    expect(h[2].sse).toBeCloseTo(221.75, 10);
    expect(h[2].pred).toEqual([18.25, 18.25, 18.25, 32.25, 40.5, 40.5]);
    expect(predictAt(h, BOOST_Y, 0.5, 2, 60)).toBe(32.25);
  });

  it("scores every candidate split the way the lesson's table does", () => {
    const res = BOOST_Y.map((y) => y - 28);
    expect(splitCandidates(BOOST_X, res).map((c) => Number(c.sse.toFixed(1)))).toEqual([987.2, 788, 200, 404, 684.8]);
  });

  it("training error never increases", () => {
    const h = boost(BOOST_X, BOOST_Y, 15, 1);
    for (let r = 1; r < h.length; r++) expect(h[r].sse).toBeLessThanOrEqual(h[r - 1].sse + 1e-9);
  });
});

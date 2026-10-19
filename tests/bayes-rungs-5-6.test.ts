import { describe, expect, it } from "vitest";
import { GP_DAYS, GP_PRIOR, pmfQuantile } from "@/components/viz/GammaPoisson";
import { bigNumber, WASH_PRIORS, WASH_TRUE_RATE } from "@/components/viz/PriorPredictive";
import { gammaInterval, gammaPoissonUpdate, negBinomialPmf, normalNormal } from "@/lib/sim/bayes";
import { lognormalQuantile, normalCdf, poolStores, repeatWorld, salesRecord, shareAbove, washOut } from "@/lib/sim/priors";
import { poissonPmf } from "@/lib/sim/prob";

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;

describe("Rung 5: gamma-Poisson", () => {
  const [a, b] = gammaPoissonUpdate(GP_PRIOR.shape, GP_PRIOR.rate, GP_DAYS.reduce((s, v) => s + v, 0), GP_DAYS.length);

  it("updates Gamma(2, 1) with 0, 2, 1 to Gamma(5, 4), mean 1.25 = ¼·2 + ¾·1", () => {
    expect([a, b]).toEqual([5, 4]);
    expect(a / b).toBe(1.25);
    expect(0.25 * 2 + 0.75 * 1).toBe(1.25);
    expect(gammaInterval(5, 4, 0.9).map(r2)).toEqual([0.49, 2.29]);
    expect(gammaInterval(2, 1, 0.9).map(r2)).toEqual([0.36, 4.74]);
  });

  it("the predictive is negative binomial with fatter tails than a Poisson", () => {
    const nb = (k: number) => negBinomialPmf(k, a, b);
    expect(nb(0)).toBeCloseTo((4 / 5) ** 5, 12);
    expect([nb(0), nb(1), nb(2)].map(r3)).toEqual([0.328, 0.328, 0.197]);
    expect(r3(1 - nb(0) - nb(1) - nb(2))).toBe(0.148);
    const po = (k: number) => poissonPmf(k, 1.25);
    expect([po(0), po(1), po(2)].map(r3)).toEqual([0.287, 0.358, 0.224]);
    expect(r3(1 - po(0) - po(1) - po(2))).toBe(0.132);
    let mean = 0;
    let sq = 0;
    for (let k = 0; k < 200; k++) {
      mean += k * nb(k);
      sq += k * k * nb(k);
    }
    expect(sq - mean * mean).toBeCloseTo(1.5625, 8);
    expect(5 / 16).toBe(0.3125);
    expect(pmfQuantile(nb, 0.95)).toBe(4);
    expect(pmfQuantile(po, 0.95)).toBe(3);
  });

  it("matches the try-this numbers and exercises", () => {
    expect(r2(15 / 14)).toBe(1.07);
    expect(gammaInterval(15, 14, 0.9).map(r2)).toEqual([0.66, 1.56]);
    expect(r2(23 / 13)).toBe(1.77);
    expect(3.5 / 3.5).toBe(1);
    expect(gammaPoissonUpdate(2, 1, 14, 7)).toEqual([16, 8]);
    expect(gammaPoissonUpdate(6, 3, 9, 9)).toEqual([15, 12]);
    expect(r3((12 / 13) ** 15)).toBe(0.301);
    expect(r3(Math.exp(-1.25))).toBe(0.287);
    expect((3.6 - 2) / 4).toBe(0.4); // 4/k = 1.6, so k = 2.5
  });

  it("pooled stores are over-dispersed by about 1 + mean/k", () => {
    expect(r2(poolStores(Infinity).ratio)).toBe(1);
    expect(r2(poolStores(2).ratio)).toBe(1.88);
    expect(poolStores(0.5).ratio).toBeGreaterThan(poolStores(2).ratio);
    expect(poolStores(8).ratio).toBeLessThan(poolStores(2).ratio);
  });
});

describe("Rung 6: priors you can defend", () => {
  it("the vague prior implies absurd sales; the weak one doesn't", () => {
    expect(bigNumber(lognormalQuantile(0, 10, 0.95))).toBe("13.9 million");
    expect(bigNumber(lognormalQuantile(0, 10, 0.99))).toBe("12.7 billion");
    expect(r2(shareAbove(0, 10, 1000))).toBe(0.24);
    expect(bigNumber(lognormalQuantile(Math.log(2), 1, 0.95))).toBe("10.4");
    expect(bigNumber(lognormalQuantile(Math.log(2), 1, 0.99))).toBe("20.5");
    expect(shareAbove(Math.log(2), 1, 1000)).toBeLessThan(1e-6);
    expect(r2(lognormalQuantile(Math.log(3), 0.5, 0.95))).toBe(6.83);
    expect(Math.exp(50)).toBeGreaterThan(5e21);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(r2(2 * (1 - normalCdf(1)))).toBe(0.32);
  });

  it("combines last year's lift test with this year's", () => {
    const p = normalNormal(6, 4, 12, 16, 1);
    expect(p.weightOnData).toBeCloseTo(0.2, 12);
    expect(p.mean).toBeCloseTo(7.2, 12);
    expect(p.variance).toBeCloseTo(3.2, 12);
    expect(r2(Math.sqrt(p.variance))).toBe(1.79);
    const q = normalNormal(4, 4, 10, 4, 1);
    expect([q.mean, q.variance]).toEqual([7, 2]);
  });

  it("the three priors wash out as in the table", () => {
    const w = washOut(WASH_PRIORS, salesRecord(WASH_TRUE_RATE, 90));
    const at = (n: number) => w.map((p) => r2(p[n]));
    expect(at(0)).toEqual([5, 2, 0.5]);
    expect(at(3)[0]).toBeGreaterThan(3.8);
    expect(at(7)).toEqual([3.08, 1.56, 0.88]);
    expect(at(30)).toEqual([1.94, 1.38, 1.13]);
    expect(at(90)).toEqual([1.76, 1.55, 1.44]);
    expect(r2(w[0][90] - w[2][90])).toBeLessThanOrEqual(0.32);
    const rec = salesRecord(WASH_TRUE_RATE, 90);
    expect(r2(rec.slice(0, 7).reduce((s, v) => s + v, 0) / 7)).toBe(1.43);
    expect(r2(rec.reduce((s, v) => s + v, 0) / 90)).toBe(1.54);
    expect(Math.round((156 / 96 - 131 / 100) * 1000) / 1000).toBe(0.315);
  });

  it("repeating the world: a defensible prior helps, a wrong one hurts", () => {
    const table: [number, number, number, number][] = [
      [1, 1.51, 0.99, 2.58],
      [3, 0.87, 0.72, 2.03],
      [7, 0.56, 0.53, 1.43],
      [30, 0.27, 0.27, 0.54],
      [60, 0.19, 0.19, 0.33],
    ];
    for (const [d, mle, good, bad] of table) {
      const r = repeatWorld(d, WASH_PRIORS[1], WASH_PRIORS[0]);
      expect([r2(r.mle), r2(r.defensible), r2(r.wrong)]).toEqual([mle, good, bad]);
    }
  });
});

import { describe, expect, it } from "vitest";
import { LR_PRICE, LR_UNITS } from "@/components/viz/LinRegPlayground";
import { normalNormal } from "@/lib/sim/bayes";
import { fitLinear } from "@/lib/sim/linreg";
import { chainWorld, mse, pool, poolingStudy, shrinkAll, slopeCoverage, slopePosterior, sse, STORE_WEEKS, tauLogLik } from "@/lib/sim/pooling";
import { mulberry32 } from "@/lib/sim/rng";

describe("Rung 7: shrinkage", () => {
  it("matches the hand table", () => {
    const rows = [1, 2, 4, 8, 20].map((n) => normalNormal(50, 100, 30, 400, n));
    expect(rows.map((r) => Math.round(r.weightOnData * 100))).toEqual([20, 33, 50, 67, 83]);
    expect(rows.map((r) => r.mean.toFixed(2))).toEqual(["46.00", "43.33", "40.00", "36.67", "33.33"]);
    expect(rows.map((r) => Math.sqrt(r.variance).toFixed(2))).toEqual(["8.94", "8.16", "7.07", "5.77", "4.08"]);
    expect((4 * 50 + 2 * 30) / 6).toBeCloseTo(43.333, 3);
    expect(Math.sqrt(400 / 2)).toBeCloseTo(14.1, 1);
  });

  it("exercises", () => {
    expect(normalNormal(50, 400, 30, 400, 2).mean).toBeCloseTo(36.667, 3);
    const s = normalNormal(50, 100, 70, 400, 12);
    expect(s.mean).toBeCloseTo(65, 10);
    expect(Math.sqrt(s.variance)).toBeCloseTo(5, 10);
    expect(normalNormal(50, 100, 80, 400, 1).mean).toBeCloseTo(56, 10);
    expect(normalNormal(50, 100, 70, 400, 20).mean).toBeCloseTo(66.67, 2);
  });

  it("the 40-store chain: raw 3,574 vs shrunk 1,026; small stores top the raw ranking; 16 stores get worse", () => {
    const c = chainWorld(mulberry32(1));
    const s = shrinkAll(c, 50, 100, 400);
    expect(Math.round(sse(c.ybar, c.theta))).toBe(3574);
    expect(Math.round(sse(s, c.theta))).toBe(1026);
    const top5 = c.ybar.map((_, j) => j).sort((a, b) => c.ybar[b] - c.ybar[a]).slice(0, 5);
    expect(top5.map((j) => Math.round(c.ybar[j]))).toEqual([85, 81, 76, 76, 72]);
    expect(Math.max(...top5.map((j) => c.n[j]))).toBeLessThanOrEqual(4);
    const best3 = c.theta.map((_, j) => j).sort((a, b) => c.theta[b] - c.theta[a]).slice(0, 3);
    expect(best3.map((j) => Math.round(c.theta[j]))).toEqual([70, 67, 66]);
    expect(best3.map((j) => c.n[j]).sort((a, b) => a - b)).toEqual([14, 16, 30]);
    const worse = c.theta.filter((t, j) => Math.abs(s[j] - t) > Math.abs(c.ybar[j] - t)).length;
    expect(worse).toBe(16);
  });

  it("1,000 chains: shrinking wins 992 times", () => {
    const rng = mulberry32(99);
    let wins = 0;
    let raw = 0;
    let shr = 0;
    for (let k = 0; k < 1000; k++) {
      const c = chainWorld(rng);
      const a = sse(c.ybar, c.theta);
      const b = sse(shrinkAll(c, 50, 100, 400), c.theta);
      if (b < a) wins++;
      raw += a / 1000;
      shr += b / 1000;
    }
    expect(wins).toBe(992);
    expect(Math.round(raw)).toBe(3575);
    expect(Math.round(shr)).toBe(1363);
  });
});

describe("Rung 8: Bayesian linear regression", () => {
  it("matches the hand numbers and equals ridge", () => {
    const p = slopePosterior(LR_PRICE, LR_UNITS, 4, 0.4);
    expect(p.mean).toBeCloseTo(-4, 10);
    expect(p.sd).toBeCloseTo(Math.sqrt(0.2), 10);
    expect(p.lambda).toBeCloseTo(10, 10);
    expect(fitLinear(LR_PRICE.map((x) => [x]), LR_UNITS, 10).coef[0]).toBeCloseTo(-4, 10);
    expect((p.mean - 1.645 * p.sd).toFixed(2)).toBe("-4.74");
    expect((p.mean + 1.645 * p.sd).toFixed(2)).toBe("-3.26");
    const flat = slopePosterior(LR_PRICE, LR_UNITS, 4, Infinity);
    expect(flat.mean).toBeCloseTo(-8, 10);
    expect(flat.sd.toFixed(3)).toBe("0.632");
    expect((flat.mean - 1.645 * flat.sd).toFixed(2)).toBe("-9.04");
    expect((flat.mean + 1.645 * flat.sd).toFixed(2)).toBe("-6.96");
    const mid = slopePosterior(LR_PRICE, LR_UNITS, 4, 6.4);
    expect(mid.mean.toFixed(2)).toBe("-7.53");
    expect(mid.sd.toFixed(2)).toBe("0.61");
    expect(slopePosterior(LR_PRICE, LR_UNITS, 4, 0.1).mean).toBeCloseTo(-1.6, 10);
    expect(slopePosterior(LR_PRICE, LR_UNITS, 4, 1.6).mean).toBeCloseTo(-6.4, 10);
    // Residual variance of the least-squares fit: 14 / 3.
    expect(14 / 3).toBeCloseTo(4.67, 2);
  });

  it("predictions and the informed prior exercise", () => {
    expect(52 + -4 * 4).toBe(36);
    expect(Math.sqrt(4 + 0.8 + 16 * 0.2)).toBeCloseTo(2.83, 2);
    expect(Math.sqrt(4 + 0.8)).toBeCloseTo(2.19, 2);
    const prec = 2.5 + 1 / 4;
    expect((-20 + -6 / 4) / prec).toBeCloseTo(-7.82, 2);
    expect(Math.sqrt(1 / prec)).toBeCloseTo(0.6, 2);
  });

  it("coverage: 90.3% matched, 0.0% wrong, 90.7% flat", () => {
    expect((slopeCoverage("matched", 2000, 5) * 100).toFixed(1)).toBe("90.3");
    expect((slopeCoverage("wrong", 2000, 5) * 100).toFixed(1)).toBe("0.0");
    expect((slopeCoverage("flat", 2000, 5) * 100).toFixed(1)).toBe("90.7");
  });
});

describe("Rung 9: hierarchical pooling", () => {
  it("matches the hand tables", () => {
    const w = (n: number) => 100 / (100 + 400 / n);
    expect((50 + w(1) * 31).toFixed(1)).toBe("56.2");
    expect((50 + w(8) * 20).toFixed(1)).toBe("63.3");
    expect((50 + w(52) * -6).toFixed(1)).toBe("44.4");
    const ys = [30, 45, 50, 55, 70];
    const m = ys.reduce((a, b) => a + b, 0) / 5;
    const spread = ys.reduce((s, v) => s + (v - m) ** 2, 0) / 4;
    expect(spread).toBe(212.5);
    const tau2 = spread - 100;
    expect(Math.sqrt(tau2).toFixed(1)).toBe("10.6");
    const wt = tau2 / (tau2 + 100);
    expect(wt.toFixed(3)).toBe("0.529");
    expect(ys.map((v) => (wt * v + (1 - wt) * m).toFixed(1))).toEqual(["39.4", "47.4", "50.0", "52.6", "60.6"]);
  });

  it("the 40-store chain matches the visual's readouts", () => {
    const c = chainWorld(mulberry32(1));
    const p = pool(c, 400);
    expect(mse(p.none, c.theta).toFixed(1)).toBe("89.3");
    expect(mse(p.complete, c.theta).toFixed(1)).toBe("81.3");
    expect(mse(p.partial, c.theta).toFixed(1)).toBe("29.3");
    expect(Math.sqrt(p.tau2).toFixed(1)).toBe("10.1");
    expect(p.mu.toFixed(1)).toBe("52.9");
    expect([c.ybar[1], p.partial[1], c.theta[1]].map((v) => Math.round(v))).toEqual([81, 59, 61]);
    expect(c.n[1]).toBe(1);
    expect([c.ybar[11], p.partial[11], c.theta[11]].map((v) => Math.round(v))).toEqual([18, 35, 27]);
    expect(c.n[11]).toBe(4);
    expect(Math.round(Math.max(...c.ybar))).toBe(85);
    expect(p.weights[39].toFixed(2)).toBe("0.93");
  });

  it("the study table and the noise prediction", () => {
    const rows = [2, 5, 10, 20, 40].map((t) => poolingStudy(t, 300, 7));
    expect(rows.map((r) => r.none.toFixed(1))).toEqual(["93.1", "93.1", "93.1", "93.1", "93.1"]);
    expect(rows.map((r) => r.complete.toFixed(1))).toEqual(["4.7", "25.7", "100.7", "400.7", "1600.9"]);
    expect(rows.map((r) => r.partial.toFixed(1))).toEqual(["6.6", "19.8", "37.3", "62.7", "82.1"]);
    const noise = STORE_WEEKS.reduce((s, n) => s + 400 / n, 0);
    expect(Math.round(noise)).toBe(3680);
    expect((noise / 40).toFixed(0)).toBe("92");
  });

  it("the posterior over tau peaks near 9 with a 90% interval of 6.7 to 12.5", () => {
    const c = chainWorld(mulberry32(1));
    const taus = Array.from({ length: 301 }, (_, i) => i * 0.1);
    const ll = taus.map((t) => tauLogLik(c, 400, t));
    const m = Math.max(...ll);
    const w = ll.map((v) => Math.exp(v - m));
    const tot = w.reduce((a, b) => a + b, 0);
    let cum = 0;
    let lo = 0;
    let hi = 0;
    taus.forEach((t, i) => {
      const prev = cum;
      cum += w[i] / tot;
      if (prev < 0.05 && cum >= 0.05) lo = t;
      if (prev < 0.95 && cum >= 0.95) hi = t;
    });
    expect(taus[ll.indexOf(m)].toFixed(1)).toBe("8.9");
    expect(lo.toFixed(1)).toBe("6.7");
    expect(hi.toFixed(1)).toBe("12.5");
  });

  it("exercises", () => {
    expect((50 + (100 / 300) * 10).toFixed(1)).toBe("53.3");
    const n = 0.25 / (0.25 + 0.04);
    expect((2.5 + n * -0.5).toFixed(2)).toBe("2.07");
    expect((2.5 + 0.2 * 1.5).toFixed(1)).toBe("2.8");
  });
});

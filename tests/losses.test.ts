import { describe, expect, it } from "vitest";
import { LM_DAYS, LM_SPIKE } from "@/components/viz/LossMirror";
import { argminGrid, bernoulliNLL, gaussianNLL, laplaceNLL, pinball, poissonNLL } from "@/lib/sim/losses";
import { gamma, mulberry32, negBinomial } from "@/lib/sim/rng";

describe("Rung 2: losses are negative log-likelihoods", () => {
  it("matches the hand table for the three days (2, 3, 7)", () => {
    const c = 1.5 * Math.log(2 * Math.PI);
    expect(gaussianNLL(LM_DAYS, 4)).toBeCloseTo(c + 7, 10);
    expect(gaussianNLL(LM_DAYS, 3)).toBeCloseTo(c + 8.5, 10);
    expect(gaussianNLL(LM_DAYS, 4)).toBeCloseTo(9.757, 3);
    expect(laplaceNLL(LM_DAYS, 3)).toBeCloseTo(3 * Math.log(2) + 5, 10);
    expect(laplaceNLL(LM_DAYS, 4)).toBeCloseTo(8.079, 3);
    expect(poissonNLL(LM_DAYS, 4)).toBeCloseTo(6.375, 3);
    expect(poissonNLL(LM_DAYS, 3)).toBeCloseTo(6.827, 3);
    expect(poissonNLL(LM_DAYS, 5)).toBeCloseTo(6.697, 3);
    expect(bernoulliNLL([1, 0, 0, 1, 0], 0.4)).toBeCloseTo(3.365, 3);
    expect(bernoulliNLL([1, 0, 0, 1, 0], 0.5)).toBeCloseTo(5 * Math.log(2), 10);
  });

  it("each NLL bottoms out at its summary: mean, median, rate, proportion", () => {
    expect(argminGrid((m) => gaussianNLL(LM_DAYS, m, 2), 0, 10)).toBeCloseTo(4, 2);
    expect(argminGrid((m) => laplaceNLL(LM_DAYS, m, 2), 0, 10)).toBeCloseTo(3, 2);
    expect(argminGrid((m) => poissonNLL(LM_DAYS, m), 0.1, 10)).toBeCloseTo(4, 2);
    expect(argminGrid((p) => bernoulliNLL([1, 0, 0, 1, 0], p), 0.01, 0.99)).toBeCloseTo(0.4, 2);
  });

  it("with an even number of days the absolute-error valley is flat between the middle two", () => {
    const d = [...LM_DAYS, LM_SPIKE];
    expect(laplaceNLL(d, 3)).toBeCloseTo(laplaceNLL(d, 7), 10);
    expect(laplaceNLL(d, 5)).toBeCloseTo(laplaceNLL(d, 3), 10);
    expect(laplaceNLL(d, 2.9)).toBeGreaterThan(laplaceNLL(d, 3));
  });

  it("pinball loss at τ = 0.9 is minimized at the 90th percentile", () => {
    const d = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const q = argminGrid((v) => pinball(d, v, 0.9), 0, 12, 12000);
    expect(q).toBeGreaterThanOrEqual(9 - 1e-9);
    expect(q).toBeLessThanOrEqual(10);
  });

  it("gamma and negative binomial draws have the right moments", () => {
    const rng = mulberry32(8);
    const g = Array.from({ length: 40000 }, () => gamma(rng, 2.5, 2));
    const gm = g.reduce((a, b) => a + b, 0) / g.length;
    expect(gm).toBeCloseTo(5, 1);
    const small = Array.from({ length: 40000 }, () => gamma(rng, 0.4, 1));
    expect(small.reduce((a, b) => a + b, 0) / small.length).toBeCloseTo(0.4, 1);
    const nb = Array.from({ length: 40000 }, () => negBinomial(rng, 2, 0.6));
    const m = nb.reduce((a, b) => a + b, 0) / nb.length;
    const v = nb.reduce((a, b) => a + (b - m) ** 2, 0) / nb.length;
    expect(m).toBeCloseTo(2, 1);
    expect(v / (2 + 4 / 0.6)).toBeGreaterThan(0.9);
    expect(v / (2 + 4 / 0.6)).toBeLessThan(1.1);
  });
});

import { describe, expect, it } from "vitest";
import { ARENA, gapToBest } from "@/components/viz/FailureMatrix";
import { bias, poissonDeviance, wape } from "@/lib/sim/metrics";

describe("Arena metrics by hand", () => {
  const y = [2, 0, 10, 8];
  const a = [3, 1, 9, 7];
  const b = [0, 0, 9, 7];
  it("WAPE ties the two forecasts; bias and deviance don't", () => {
    expect(wape(y, a)).toBeCloseTo(0.2, 12);
    expect(wape(y, b)).toBeCloseTo(0.2, 12);
    expect(bias(y, a)).toBeCloseTo(0, 12);
    expect(bias(y, b)).toBeCloseTo(-0.2, 12);
    expect(poissonDeviance(y, a)).toBeCloseTo(0.655, 3);
    expect(poissonDeviance(y, b)).toBeGreaterThan(13);
  });
});

describe("arena.json", () => {
  it("has every model on every scenario, with exactly one best per scenario", () => {
    expect(ARENA.scenarios.length).toBeGreaterThanOrEqual(7);
    for (const s of ARENA.scenarios) {
      expect(Object.keys(s.results).sort()).toEqual(ARENA.models.map((m) => m.id).sort());
      const gaps = ARENA.models.map((m) => gapToBest(s, m.id));
      expect(Math.min(...gaps)).toBe(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  bestPrice,
  CROSS,
  CS,
  crossStudy,
  demandAt,
  DRILL,
  drillShares,
  EL,
  elasticityStudy,
  EN,
  endogeneityWeeks,
  EP,
  GLUE_EPS,
  HE,
  hierStudy,
  hoseFits,
  LINE,
  logElasticity,
  mnlElasticities,
  ols,
  PAINT,
  pctRatio,
  pointElasticity,
  profitAt,
  promoOutcome,
  randomUtilityStudy,
  softmax,
} from "@/lib/sim/elasticity";

const r = (v: number, d: number) => Number(v.toFixed(d));

describe("elasticity-derivative", () => {
  it("the two glue weeks by hand", () => {
    expect(r(pctRatio(200, 500, 250, 256), 2)).toBe(-1.95);
    expect(r(pctRatio(250, 256, 200, 500), 2)).toBe(-4.77);
    expect(r(244 / 500, 3)).toBe(0.488);
    expect(r(244 / 256, 3)).toBe(0.953);
    expect(r(Math.log(256 / 500), 3)).toBe(-0.669);
    expect(r(Math.log(250 / 200), 3)).toBe(0.223);
    expect(r(GLUE_EPS, 2)).toBe(-3);
    expect(r(logElasticity(250, 256, 200, 500), 2)).toBe(-3);
    expect([200 * 500, 250 * 256]).toEqual([100000, 64000]);
    expect([(200 - EL.cost) * 500, (250 - EL.cost) * 256]).toEqual([25000, 25600]);
    expect(r(bestPrice("constant"), 2)).toBe(225);
    expect(Math.round(demandAt("constant", 225))).toBe(351);
    expect(Math.round(profitAt("constant", 225))).toBe(26337);
  });

  it("the two demand curves", () => {
    expect(LINE).toEqual({ a: 1476, b: 4.88 });
    expect(r(pointElasticity("line", 200), 2)).toBe(-1.95);
    expect(r(pointElasticity("line", 250), 2)).toBe(-4.77);
    expect(Math.round(bestPrice("line"))).toBe(226);
    expect([Math.round(demandAt("constant", 300)), Math.round(demandAt("line", 300))]).toEqual([148, 12]);
    // Revenue on the line peaks at unit elasticity
    const pr = LINE.a / (2 * LINE.b);
    expect(r(pr, 1)).toBe(151.2);
    expect(Math.round(demandAt("line", pr))).toBe(738);
    expect(r(pointElasticity("line", pr), 6)).toBe(-1);
    expect(Math.round(pr * demandAt("line", pr))).toBe(111607);
    // Midpoint formula and the slope in bottles per rupee
    expect(r((-244 / 378) / (50 / 225), 2)).toBe(-2.9);
    expect((GLUE_EPS * 500) / 200).toBeCloseTo(-7.5, 9);
  });

  it("the precision study", () => {
    const rows = EP.sds.map((s) => {
      const st = elasticityStudy(s, 52);
      return [r(st.sd, 2), r(st.close, 3), r(st.inelastic, 3)];
    });
    expect(rows).toEqual([
      [1.77, 0.234, 0.134],
      [0.71, 0.534, 0.003],
      [0.35, 0.842, 0],
      [0.18, 0.996, 0],
    ]);
    expect(r(elasticityStudy(0.02, 104).sd, 2)).toBe(1.22);
  });

  it("the exercises", () => {
    expect(r(1.1 * 0.85, 3)).toBe(0.935);
    expect(r(logElasticity(400, 120, 440, 100), 2)).toBe(-1.91);
    expect(bestPrice("constant", 300, -4)).toBeCloseTo(400, 9);
    expect(-1 / 0.4).toBe(-2.5);
    expect(bestPrice("constant", 150, -0.8)).toBe(Infinity);
  });
});

describe("cx-cross-elasticity", () => {
  it("the hand table", () => {
    const o = promoOutcome(0, 0.2);
    expect(o.units.map((u) => r(u, 6))).toEqual([320, 240, 135, 130]);
    expect(o.itemLift).toBeCloseTo(120, 6);
    expect(o.categoryLift).toBeCloseTo(45, 6);
    expect(o.cannibalized).toBeCloseTo(75, 6);
    expect(75 / 120).toBe(0.625);
    expect(o.halo).toBeCloseTo(30, 6);
    expect(Math.round(o.itemMargin)).toBe(42000);
    expect(Math.round(o.totalMargin)).toBe(23400);
    expect(PAINT.map((p) => p.price - p.cost)).toEqual([350, 300, 280, 120]);
    expect([60 * 300, 15 * 280, 30 * 120]).toEqual([18000, 4200, 3600]);
    expect(r(23400 / 42000, 2)).toBe(0.56);
    expect(r(Math.log(0.8), 3)).toBe(-0.223);
    expect(CROSS.map((row) => r(row[0], 2))).toEqual([-2.11, 1, 0.47, -1.18]);
  });

  it("the promo explorer", () => {
    const own = promoOutcome(2, 0.2);
    expect(Math.round(own.units[2])).toBe(234);
    expect(Math.round(own.itemLift)).toBe(84);
    expect(Math.round(own.itemMargin)).toBe(-9188);
    expect(Math.round(own.totalMargin)).toBe(-17366);
    expect(Math.round(own.cannibalized)).toBe(30);
    expect(Math.round(own.halo)).toBe(12);
    const lumen = promoOutcome(1, 0.2);
    expect([Math.round(lumen.itemLift), Math.round(lumen.categoryLift), Math.round(lumen.cannibalized), Math.round(lumen.totalMargin)]).toEqual([224, 148, 76, 45375]);
    expect(Math.round(promoOutcome(2, 0.1).totalMargin)).toBe(-7067);
    const k30 = promoOutcome(0, 0.3);
    expect([Math.round(k30.itemMargin), Math.round(k30.totalMargin), Math.round(k30.cannibalized)]).toEqual([78377, 51119, 113]);
    expect(CROSS[1][1]).toBeLessThan(CROSS[0][0]);
    expect(lumen.categoryLift / lumen.itemLift).toBeGreaterThan(45 / 120);
  });

  it("the cross-elasticity study", () => {
    const rows = [0, 0.5, 0.75, 0.9].map((o) => {
      const s = crossStudy(o);
      return [r(s.sd, 2), r(s.far, 2), r(s.wrongSign, 3), s.unusable];
    });
    expect(rows).toEqual([
      [0.36, 0.16, 0, 0],
      [0.38, 0.16, 0.004, 0],
      [0.5, 0.3, 0.022, 0],
      [0.84, 0.49, 0.092, 9],
    ]);
    expect(CS.reps).toBe(500);
  });

  it("diversion, symmetry and the exercises", () => {
    expect(r((CROSS[1][0] * 300) / (-CROSS[0][0] * 200), 2)).toBe(0.71);
    const dA = 200 * (0.99 ** CROSS[0][0] - 1);
    const dB = 300 * (0.99 ** CROSS[1][0] - 1);
    expect(r(-dB / dA, 2)).toBe(0.7);
    expect(r(CROSS[0][2], 2)).toBe(0.25);
    expect([PAINT[0].price * PAINT[0].base, PAINT[2].price * PAINT[2].base]).toEqual([200000, 105000]);
    expect(r(logElasticity(1, 1, 0.9, 1.06), 2)).toBe(-0.55);
    expect(100 * 200 - 40 * 250 + 20 * 50).toBe(11000);
    const k10 = promoOutcome(0, 0.1);
    expect(k10.units.map(Math.round)).toEqual([250, 270, 143, 113]);
    expect([Math.round(k10.itemLift), Math.round(k10.categoryLift), Math.round(k10.cannibalized)]).toEqual([50, 12, 37]);
    expect(r(k10.cannibalized / k10.itemLift, 2)).toBe(0.75);
    expect(r(150 * 0.8 ** -2, 1)).toBe(234.4);
    expect(Math.round(150 * 0.8 ** -2 * 140)).toBe(32812);
    expect(42000 / 140).toBe(300);
    expect(r(CROSS[0][1], 2)).toBe(1.35);
  });
});

describe("cx-mnl", () => {
  it("the hand shares", () => {
    expect(DRILL.hand.map((v) => r(v, 2))).toEqual([1.39, 0.69, 0]);
    expect(drillShares("three").shares.map((s) => r(s, 4))).toEqual([0.5, 0.25, 0.125, 0.125]);
    expect(drillShares("stockout").shares.map((s) => r(s, 4))).toEqual([0.5, 0.25, 0.25]);
    const cut = drillShares("three", 2500);
    expect(r(2 * Math.exp(0.4), 2)).toBe(2.98);
    expect(cut.shares.map((s) => r(s, 3))).toEqual([0.445, 0.332, 0.111, 0.111]);
    expect(r(1 - cut.kestrel / 0.5, 2)).toBe(0.11);
    expect(r(1 - cut.none / 0.125, 2)).toBe(0.11);
    const red = drillShares("red");
    expect([r(red.kestrel, 3), r(red.own, 3)]).toEqual([0.667, 0.167]);
  });

  it("the share explorer and the nest", () => {
    const at = (l: number) => drillShares("red", 3000, l);
    expect([r(at(0.05).kestrel, 3), r(at(0.05).own, 3)]).toEqual([0.509, 0.246]);
    expect(r(at(0.75).kestrel, 3)).toBe(0.627);
    expect([r(at(0.5).kestrel, 3), r(at(0.5).own, 3)]).toEqual([0.586, 0.207]);
    expect(r(Math.sqrt(32), 2)).toBe(5.66);
    expect(drillShares("three", 4500).shares.map((s) => r(s, 3)).slice(0, 2)).toEqual([0.606, 0.091]);
    expect(r(drillShares("stockout", 2500).own, 3)).toBe(0.599);
  });

  it("random utility converges to the softmax only with Gumbel noise", () => {
    const gaps = [100, 1000, 10000, 100000].map((n) => [r(randomUtilityStudy(n, "gumbel").gap * 100, 1), r(randomUtilityStudy(n, "normal").gap * 100, 1)]);
    expect(gaps).toEqual([
      [5, 2],
      [1.2, 2.2],
      [0.8, 0.7],
      [0.2, 1],
    ]);
    expect(randomUtilityStudy(100000, "normal").sim.map((s) => r(s, 3))).toEqual([0.51, 0.255, 0.118, 0.117]);
  });

  it("logit elasticities, β from shares and the exercises", () => {
    const e = mnlElasticities();
    expect(e.own.map((v) => r(v, 2))).toEqual([-1.8, -1.8, -1.4]);
    expect(e.cross.map((v) => r(v, 2))).toEqual([1.8, 0.6, 0.2]);
    const cut = drillShares("three", 2500);
    expect(r(Math.log(0.25 / 0.125), 2)).toBe(0.69);
    expect(r(Math.log(cut.own / cut.none), 2)).toBe(1.09);
    expect(r(Math.log(cut.own / cut.none) - Math.log(2), 6)).toBe(0.4);
    expect(r((Math.log(8) - Math.log(4)) / DRILL.beta, 3)).toBe(0.866);
    expect(softmax([Math.log(3), 0, 0, 0]).map((s) => r(s, 3))).toEqual([0.5, 0.167, 0.167, 0.167]);
    expect(softmax([0, 0, 0]).map((s) => r(s, 3))).toEqual([0.333, 0.333, 0.333]);
    expect(softmax([Math.log(4) / 2, Math.log(2) / 2, 0, 0]).map((s) => r(s, 3))).toEqual([0.369, 0.261, 0.185, 0.185]);
    expect(r(Math.exp(Math.log(2) / 2), 2)).toBe(1.41);
  });
});

describe("cx-endogeneity", () => {
  it("the four hose weeks", () => {
    const f = hoseFits();
    expect(r(f.usual, 2)).toBe(1.11);
    expect(r(Math.log(1.28), 3)).toBe(0.247);
    expect(r(f.pooled, 2)).toBe(-0.44);
    expect(r(f.withSeason, 2)).toBe(-2);
    expect(r(logElasticity(1000, 100, 800, 156), 2)).toBe(-1.99);
    expect(r(logElasticity(1250, 128, 1000, 200), 2)).toBe(-2);
    // Without rounding 156.25 to 156, the season term is exactly ln 2
    const b = ols(
      [
        [1, 0, Math.log(1000)],
        [1, 0, Math.log(800)],
        [1, 1, Math.log(1250)],
        [1, 1, Math.log(1000)],
      ],
      [100, 156.25, 128, 200].map(Math.log),
    );
    expect(r(b[1], 2)).toBe(0.69);
    expect(r(b[2], 6)).toBe(-2);
  });

  it("prices that follow demand, and the instrument", () => {
    const rows = EN.kappas.map((k) => {
      const d = endogeneityWeeks(k);
      return [r(d.naive, 2), r(d.iv, 2)];
    });
    expect(rows).toEqual([
      [-2, -2],
      [-0.62, -2],
      [-0.04, -2],
      [-0.02, -2],
      [-0.19, -2],
    ]);
    const bias = (k: number) => (k * EN.shockSd ** 2) / (k * k * EN.shockSd ** 2 + EN.costSd ** 2);
    expect(r(bias(0.3), 2)).toBe(1.86);
    expect(r(EN.eps + bias(0.3), 2)).toBe(-0.14);
    expect(r(EN.costSd / EN.shockSd, 2)).toBe(0.27);
    expect(r(EN.shockSd / (2 * EN.costSd), 2)).toBe(1.88);
    expect(r(bias(EN.costSd / EN.shockSd), 4)).toBe(r(EN.shockSd / (2 * EN.costSd), 4));
  });

  it("pooling sixty SKUs", () => {
    const rows = HE.weeks.map((w) => {
      const s = hierStudy(w);
      return [r(s.rmseRaw, 2), r(s.rmsePooled, 2), s.inelasticRaw, s.inelasticPooled, s.positiveRaw, s.inelasticTrue];
    });
    expect(rows).toEqual([
      [1.02, 0.47, 12, 1, 2, 1],
      [0.67, 0.41, 8, 0, 1, 1],
      [0.48, 0.35, 4, 0, 0, 1],
      [0.31, 0.27, 4, 0, 0, 1],
    ]);
    const s = hierStudy(13);
    expect(r(s.mu, 2)).toBe(-1.92);
    expect([r(Math.min(...s.weight), 2), r(Math.max(...s.weight), 2)]).toEqual([0.07, 0.61]);
    expect(HE.skus).toBe(60);
  });

  it("the exercises", () => {
    expect(r(logElasticity(500, 80, 600, 96), 2)).toBe(1);
    expect(-2.5 + 0.02 / 0.04).toBe(-2);
    expect(r(Math.log(0.82) / Math.log(1.1), 2)).toBe(-2.08);
    const w = 0.25 / (0.25 + 1);
    expect(w).toBe(0.2);
    expect(r(-2 + w * (0.4 + 2), 2)).toBe(-1.52);
  });
});

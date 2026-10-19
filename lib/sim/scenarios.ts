// Failure Lab scenarios: small Bolt & Beam situations where at least one model breaks.
// Every scenario is seeded, so the same models fail the same way for every learner.

import type { Matrix } from "./linalg";
import { mulberry32, normal, poisson } from "./rng";

export type ModelId = "linear" | "tree" | "gbm" | "mlp";

export type Scenario = {
  id: string;
  name: string;
  story: string;
  xLabel: string;
  yLabel: string;
  /** Plot range for the first feature. */
  domain: [number, number];
  /** Optional second feature: a 0/1 flag drawn as a second line per model. */
  groups?: [string, string];
  train: { X: Matrix; y: number[] };
  test: { X: Matrix; y: number[] };
  /** Extra check reported next to test error. */
  check?: "negatives" | "rises";
  verdict: Record<ModelId, string>;
};

const range = <T = number>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));

function trend(): Scenario {
  const rng = mulberry32(101);
  const f = (w: number) => 200 + 4 * w;
  const mk = (weeks: number[]) => ({ X: weeks.map((w) => [w]), y: weeks.map((w) => Math.round(f(w) + normal(rng, 0, 12))) });
  return {
    id: "trend",
    name: "Trend extrapolation",
    story: "Paint sales have grown about 4 units a week all year. Forecast the 12 festive weeks after the training data ends.",
    xLabel: "Week",
    yLabel: "Units per week",
    domain: [1, 52],
    train: mk(range(40, (i) => i + 1)),
    test: mk(range(12, (i) => i + 41)),
    verdict: {
      linear: "Extends the trend straight through the festive weeks. When the future is a continuation of a line, a line wins.",
      tree: "Flat after week 40. A tree can only predict averages of training leaves, so it never predicts a value above the highest leaf.",
      gbm: "Also flat. A sum of trees is still piecewise constant, so boosting inherits the tree's blindness beyond the training range.",
      mlp: "Keeps going, roughly linearly: beyond the data a ReLU network is linear. Whether the slope is right depends on the last kinks it learned.",
    },
  };
}

function outlier(): Scenario {
  const rng = mulberry32(202);
  const f = (p: number) => 300 - 0.4 * p;
  const prices = range(20, (i) => 400 + i * 10);
  const y = prices.map((p) => Math.round(f(p) + normal(rng, 0, 6)));
  y[17] = 260; // a contractor's bulk order at ₹570
  const testP = range(40, (i) => 400 + i * 5);
  return {
    id: "outlier",
    name: "One outlier week",
    story: "A contractor bought 260 tins in a single week at ₹570. Every other week follows the normal price response.",
    xLabel: "Price (₹)",
    yLabel: "Units per week",
    domain: [400, 600],
    train: { X: prices.map((p) => [p]), y },
    test: { X: testP.map((p) => [p]), y: testP.map((p) => Math.round(f(p) + normal(rng, 0, 6))) },
    verdict: {
      linear: "Squared error makes one 200-unit miss cost as much as 400 ten-unit misses, so the whole line tilts toward the outlier.",
      tree: "Isolates the outlier in its own leaf. The damage is local, but it predicts a bulk order for every price near ₹570.",
      gbm: "Chases the outlier for many rounds with squared loss. An absolute or Huber loss would shrug it off.",
      mlp: "Bends to reach the outlier. With enough capacity a network memorizes it, just more smoothly than a tree.",
    },
  };
}

function saturation(): Scenario {
  const rng = mulberry32(303);
  const f = (d: number) => 50 + 80 * (1 - Math.exp(-d / 10));
  const mk = (n: number) => {
    const d = range(n, () => Math.round(rng() * 400) / 10);
    return { X: d.map((v) => [v]), y: d.map((v) => Math.round(f(v) + normal(rng, 0, 5))) };
  };
  return {
    id: "saturation",
    name: "Diminishing returns",
    story: "Deeper discounts sell more drills, but each extra point of discount adds less than the one before.",
    xLabel: "Discount (%)",
    yLabel: "Units per week",
    domain: [0, 40],
    train: mk(30),
    test: mk(60),
    verdict: {
      linear: "A straight line through a curve: too high at both ends, too low in the middle. Add a log or a Hill transform and it recovers.",
      tree: "A staircase. Each step is honest, but a smooth response needs many steps and therefore many rows.",
      gbm: "Many small staircases summed: a good approximation of the curve, with tiny steps visible up close.",
      mlp: "A smooth bend from a few ReLU kinks. This is the shape networks find easy.",
    },
  };
}

function step(): Scenario {
  const rng = mulberry32(404);
  const f = (w: number) => (w >= 27 ? 170 : 120);
  const weeks = range(52, (i) => i + 1);
  const isTest = weeks.map(() => rng() < 0.3);
  const ys = weeks.map((w) => Math.round(f(w) + normal(rng, 0, 6)));
  const pick = (t: boolean) => ({
    X: weeks.filter((_, i) => isTest[i] === t).map((w) => [w]),
    y: ys.filter((_, i) => isTest[i] === t),
  });
  return {
    id: "step",
    name: "A step change",
    story: "Store 12 was remodeled in week 27 and sales jumped overnight. Predict weeks held out from the whole year.",
    xLabel: "Week",
    yLabel: "Units per week",
    domain: [1, 52],
    train: pick(false),
    test: pick(true),
    verdict: {
      linear: "Draws one sloped line through two flat levels, wrong almost everywhere. It needs a 'remodeled' feature to be told about the jump.",
      tree: "One split at week 26.5 and it's done. Sudden jumps are exactly what axis-aligned splits are good at.",
      gbm: "Finds the same split in its first trees, then spends the rest fitting noise around the two levels.",
      mlp: "Approximates the jump with a steep ramp, so the weeks right around the remodel come out wrong.",
    },
  };
}

function interaction(): Scenario {
  const rng = mulberry32(505);
  const f = (p: number, promo: number) => (promo ? 330 - 0.5 * p : 160 - 0.1 * p);
  const mk = (n: number) => {
    const X = range(n, (i) => [Math.round(300 + rng() * 300), i % 2]);
    return { X, y: X.map(([p, g]) => Math.round(f(p, g) + normal(rng, 0, 6))) };
  };
  return {
    id: "interaction",
    name: "Promo × price interaction",
    story: "During a promo, shoppers are five times as price sensitive. The slope itself depends on the promo flag.",
    xLabel: "Price (₹)",
    yLabel: "Units per week",
    domain: [300, 600],
    groups: ["No promo", "Promo"],
    train: mk(40),
    test: mk(80),
    verdict: {
      linear: "Gives both groups the same slope (parallel lines) because nothing in the model lets the slope change. A price × promo column fixes it.",
      tree: "Can split on promo and then on price inside each branch, so interactions come free, at the cost of staircases.",
      gbm: "Captures the interaction with depth-2 trees (one promo split, one price split per tree). Depth 1 stumps could not.",
      mlp: "Learns two different slopes because hidden units can combine price and promo before the ReLU.",
    },
  };
}

export function small(seed = 605): Scenario {
  const rng = mulberry32(seed);
  const f = (x: number) => 40 + 0.5 * x;
  const mk = (xs: number[]) => ({ X: xs.map((v) => [v]), y: xs.map((v) => Math.round(f(v) + normal(rng, 0, 10))) });
  return {
    id: "small",
    name: "A new store with 6 weeks",
    story: "Store 41 opened six weeks ago. Footfall drives sales, but six noisy weeks are all the data there is.",
    xLabel: "Footfall (hundreds)",
    yLabel: "Units per week",
    domain: [20, 120],
    train: mk([25, 40, 55, 70, 90, 110]),
    test: mk(range(50, (i) => 20 + i * 2)),
    verdict: {
      linear: "Two parameters for six points: low variance, and here also the right shape. Simple models win small-data fights.",
      tree: "Memorizes six noisy points as steps. Each leaf rests on one or two weeks, so the noise becomes the prediction.",
      gbm: "Driven to near-zero training error, it fits the noise too. Early stopping or heavy regularization is essential with this little data.",
      mlp: "Hundreds of weights for six points. It can pass through nearly every one of them, and it does.",
    },
  };
}

function zeros(): Scenario {
  const rng = mulberry32(707);
  const rate = (p: number) => Math.exp(1.2 - 0.0015 * (p - 800));
  const mk = (ps: number[]) => ({ X: ps.map((p) => [p]), y: ps.map((p) => poisson(rng, rate(p))) });
  return {
    id: "zeros",
    name: "Intermittent demand",
    story: "A premium cordless drill sells a handful a day, often zero. A new top-end model will sit at ₹2,400, above every price seen so far.",
    xLabel: "Price (₹)",
    yLabel: "Units per day",
    domain: [800, 2400],
    train: mk(range(60, (i) => 800 + i * 20)),
    test: mk(range(40, (i) => 1600 + i * 20)),
    check: "negatives",
    verdict: {
      linear: "Its straight line crosses zero and predicts negative sales at the top prices. A Poisson GLM (log link) can't go below zero.",
      tree: "Never negative (it predicts leaf averages), but flat beyond the highest training price.",
      gbm: "Same as the tree with squared loss. With a Poisson or Tweedie loss the scores live on a log scale and stay positive.",
      mlp: "Extrapolates linearly and can dip below zero. A softplus or exp output layer would keep it positive.",
    },
  };
}

export function monotone(seed = 805): Scenario {
  const rng = mulberry32(seed);
  const f = (p: number) => 220 - 0.25 * p;
  const mk = (n: number) => {
    const ps = range(n, () => Math.round(300 + rng() * 400));
    return { X: ps.map((p) => [p]), y: ps.map((p) => Math.round(f(p) + normal(rng, 0, 18))) };
  };
  return {
    id: "monotone",
    name: "Price should only hurt",
    story: "Raising the price of a tile adhesive never sells more of it. The data are noisy, though, and noise has bumps.",
    xLabel: "Price (₹)",
    yLabel: "Units per week",
    domain: [300, 700],
    train: mk(40),
    test: mk(80),
    check: "rises",
    verdict: {
      linear: "One slope, so it can only go down: it obeys the business rule by construction.",
      tree: "Some leaves at higher prices predict more than leaves at lower prices. A pricing team will not trust that curve.",
      gbm: "Wiggles up in places. XGBoost and LightGBM accept monotone_constraints, which forbid exactly this.",
      mlp: "Mostly smooth but can still rise in spots. Monotone networks need constrained weights or a penalty.",
    },
  };
}

export const scenarios: Scenario[] = [trend(), outlier(), saturation(), step(), interaction(), small(), zeros(), monotone()];

export function getScenario(id: string): Scenario {
  const s = scenarios.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario ${id}`);
  return s;
}

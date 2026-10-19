"use client";

import { useMemo, useState } from "react";
import { mulberry32, normal } from "@/lib/sim/rng";
import { entropy, fitTree, gini, leaves, predictTree, prune, regions, splitCandidates, type TreeNode } from "@/lib/sim/tree";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

// Eight Bolt & Beam stores: city tier, floor area (thousand sq ft) and weekly paint sales (litres).
export const DT_NAMES = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];
export const DT_X = [
  [1, 30],
  [1, 25],
  [1, 18],
  [2, 28],
  [2, 15],
  [3, 22],
  [3, 12],
  [2, 10],
];
export const DT_Y = [120, 110, 100, 80, 60, 50, 40, 40];

// Eight SKUs: days of stock cover left, and whether the SKU stocked out the next week.
export const STOCKOUT_COVER = [2, 3, 4, 5, 7, 9, 12, 15];
export const STOCKOUT_LABEL = [1, 1, 0, 1, 0, 0, 0, 0];

const SEQ = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];
const seqColor = (v: number, lo: number, hi: number) => SEQ[Math.max(0, Math.min(4, Math.floor(((v - lo) / (hi - lo || 1)) * 5)))];
const FEATURES = ["City tier", "Floor area"];

const VW = 460;
const H = 250;

export function TreeSplitByHand() {
  const [feature, setFeature] = useState(1);
  const [depth, setDepth] = useState(0);
  const rows = DT_X.map((_, i) => i);
  const cands = useMemo(() => splitCandidates(DT_X, DT_Y, rows, "sse").filter((c) => c.feature === feature), [feature]); // eslint-disable-line react-hooks/exhaustive-deps
  const allBest = useMemo(() => splitCandidates(DT_X, DT_Y, rows, "sse").reduce((a, b) => (b.gain > a.gain ? b : a)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [ci, setCi] = useState(3);
  const c = cands[Math.min(ci, cands.length - 1)];
  const tree = useMemo(() => fitTree(DT_X, DT_Y, { maxDepth: depth }), [depth]);
  const regs = regions(tree, [0.5, 6], [3.5, 34]);

  const x = linear([6, 34], [44, VW - 14]);
  const y = linear([0.5, 3.5], [H - 34, 12]);
  const mean = (idx: number[]) => idx.reduce((s, i) => s + DT_Y[i], 0) / idx.length;

  return (
    <Panel
      title="Pick a split yourself, then let the tree grow"
      footer={
        <>
          Split {FEATURES[c.feature].toLowerCase()} at {fmt(c.threshold, 1)}: left mean {fmt(mean(c.left), 2)}, right mean {fmt(mean(c.right), 2)}. Squared error{" "}
          <span className="font-semibold tabular" data-testid="ts-sse">{fmt(c.leftImpurity + c.rightImpurity, 2)}</span> (was 7,200), so the split gains{" "}
          <span className="font-semibold tabular" data-testid="ts-gain">{fmt(c.gain, 2)}</span>.
          {c.feature === allBest.feature && c.threshold === allBest.threshold && <span className="text-good"> ✓ The best split of all.</span>}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Feature to split on">
        {FEATURES.map((f, j) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={feature === j}
            onClick={() => {
              setFeature(j);
              setCi(0);
            }}
            className={feature === j ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            Split on {f.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Slider
          id="ts-threshold"
          label="Threshold (midpoints between stores)"
          value={Math.min(ci, cands.length - 1)}
          min={0}
          max={cands.length - 1}
          step={1}
          onChange={setCi}
          display={(i) => fmt(cands[Math.min(i, cands.length - 1)].threshold, 1)}
        />
        <Slider id="ts-depth" label="Grow the tree: depth" value={depth} min={0} max={2} step={1} onChange={setDepth} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Eight stores by city tier and floor area, with the tree's regions">
        {regs.map((r) => (
          <rect
            key={r.id}
            x={x(r.lo[1])}
            y={y(r.hi[0])}
            width={x(r.hi[1]) - x(r.lo[1])}
            height={y(r.lo[0]) - y(r.hi[0])}
            fill={seqColor(r.value, 40, 120)}
            fillOpacity={0.35}
            stroke="var(--surface-1)"
            strokeWidth={2}
          />
        ))}
        {depth > 0 &&
          regs.map((r) => (
            <text key={`t${r.id}`} x={x(r.hi[1]) - 4} y={y(r.lo[0]) - 5} fontSize={11} textAnchor="end" fill="var(--ink)" className="tabular">
              predicts {fmt(r.value, 1)}
            </text>
          ))}
        <Axis scale={x} orient="bottom" at={H - 34} label="floor area (thousand sq ft)" />
        <Axis scale={y} orient="left" at={44} tickValues={[1, 2, 3]} format={(v) => `T${v}`} label="tier" />
        {c.feature === 1 ? (
          <line x1={x(c.threshold)} x2={x(c.threshold)} y1={12} y2={H - 34} stroke="var(--ink)" strokeDasharray="5 4" strokeWidth={1.5} />
        ) : (
          <line x1={44} x2={VW - 14} y1={y(c.threshold)} y2={y(c.threshold)} stroke="var(--ink)" strokeDasharray="5 4" strokeWidth={1.5} />
        )}
        {DT_X.map(([tier, area], i) => {
          const left = c.left.includes(i);
          return (
            <g key={i}>
              <circle cx={x(area)} cy={y(tier)} r={6} fill={left ? "var(--series-1)" : "var(--series-2)"} stroke="var(--surface-1)" strokeWidth={2} />
              <text x={x(area)} y={y(tier) - 10} fontSize={11} textAnchor="middle" fill="var(--ink)" className="tabular">
                {DT_Y[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Goes left (below the threshold)" />
        <Key color="var(--series-2)" label="Goes right" />
        <Key color="var(--seq-550)" label="Tree regions, darker = higher prediction" shape="bar" />
      </div>
    </Panel>
  );
}

// A bigger fictional chain for the depth playground: sales rise with area, fall with distance
// from the city centre, and big central stores get an extra bump.
function storeWorld(n: number, seed: number) {
  const rng = mulberry32(seed);
  const X = Array.from({ length: n }, () => [10 + rng() * 30, rng() * 20]);
  const y = X.map(([a, d]) => 30 + 2 * a - 1.5 * d + (a > 25 && d < 8 ? 15 : 0) + normal(rng, 0, 8));
  return { X, y };
}

const rmse = (t: TreeNode, X: number[][], y: number[]) => Math.sqrt(X.reduce((s, r, i) => s + (predictTree(t, r) - y[i]) ** 2, 0) / X.length);

export function TreeDepthPlayground() {
  const train = useMemo(() => storeWorld(120, 9), []);
  const test = useMemo(() => storeWorld(600, 10), []);
  const [depth, setDepth] = useState(3);
  const [minLeaf, setMinLeaf] = useState(1);
  const [alpha, setAlpha] = useState(0);
  const tree = useMemo(() => prune(fitTree(train.X, train.y, { maxDepth: depth, minLeaf }), alpha), [train, depth, minLeaf, alpha]);
  const curve = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const t = prune(fitTree(train.X, train.y, { maxDepth: i + 1, minLeaf }), alpha);
        return { d: i + 1, train: rmse(t, train.X, train.y), test: rmse(t, test.X, test.y) };
      }),
    [train, test, minLeaf, alpha],
  );
  const regs = regions(tree, [10, 0], [40, 20]);
  const ys = train.y;
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);

  const x = linear([10, 40], [56, VW - 14]);
  const y = linear([0, 20], [H - 34, 12]);
  const ex = linear([1, 10], [56, VW - 14]);
  const ey = linear([0, 14], [H - 34, 12]);
  const testNow = rmse(tree, test.X, test.y);
  const trainNow = rmse(tree, train.X, train.y);

  return (
    <Panel
      title="120 stores, one tree. Deeper trees memorize; pruning and min-leaf push back."
      footer={
        <>
          {leaves(tree).length} leaves. Train error <span className="font-semibold tabular">{fmt(trainNow, 1)}</span>, test error on 600 new stores{" "}
          <span className="font-semibold tabular" data-testid="td-test">{fmt(testNow, 1)}</span> litres. The noise alone is 8, so nothing can beat about 8.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider id="td-depth" label="Max depth" value={depth} min={1} max={10} step={1} onChange={setDepth} />
        <Slider id="td-minleaf" label="Min rows per leaf" value={minLeaf} min={1} max={20} step={1} onChange={setMinLeaf} />
        <Slider id="td-alpha" label="Pruning α" value={alpha} min={0} max={3000} step={100} onChange={setAlpha} />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="The tree's regions over floor area and distance to the city centre">
          {regs.map((r) => (
            <rect
              key={r.id}
              x={x(r.lo[0])}
              y={y(r.hi[1])}
              width={x(r.hi[0]) - x(r.lo[0])}
              height={y(r.lo[1]) - y(r.hi[1])}
              fill={seqColor(r.value, lo, hi)}
              fillOpacity={0.55}
              stroke="var(--surface-1)"
              strokeWidth={1}
            />
          ))}
          <Axis scale={x} orient="bottom" at={H - 34} label="floor area (thousand sq ft)" />
          <Axis scale={y} orient="left" at={56} label="km to centre" />
          {train.X.map(([a, d], i) => (
            <circle key={i} cx={x(a)} cy={y(d)} r={2.5} fill="var(--ink)" fillOpacity={0.7} />
          ))}
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Train and test error by depth">
          <Axis scale={ey} orient="left" at={56} gridTo={VW - 14} label="error (litres)" />
          <Axis scale={ex} orient="bottom" at={H - 34} label="max depth" tickValues={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
          <line x1={56} x2={VW - 14} y1={ey(8)} y2={ey(8)} stroke="var(--muted)" strokeDasharray="3 3" />
          {(["train", "test"] as const).map((k) => (
            <polyline
              key={k}
              points={curve.map((p) => `${ex(p.d)},${ey(Math.min(14, p[k]))}`).join(" ")}
              fill="none"
              stroke={k === "train" ? "var(--series-1)" : "var(--series-2)"}
              strokeWidth={2}
            />
          ))}
          <line x1={ex(depth)} x2={ex(depth)} y1={12} y2={H - 34} stroke="var(--ink)" strokeDasharray="4 3" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-550)" label="Region prediction (darker = more)" shape="bar" />
        <Key color="var(--series-1)" label="Train error" shape="line" />
        <Key color="var(--series-2)" label="Test error" shape="line" />
        <Key color="var(--muted)" label="Noise floor" shape="line" />
      </div>
    </Panel>
  );
}

export function ImpurityCurves() {
  const [p, setP] = useState(0.375);
  const ps = Array.from({ length: 101 }, (_, i) => i / 100);
  const x = linear([0, 1], [44, VW - 14]);
  const y = linear([0, 1], [H - 34, 12]);
  const curves = [
    { name: "Entropy (bits)", f: entropy, color: "var(--series-1)" },
    { name: "Gini", f: gini, color: "var(--series-2)" },
    { name: "Misclassification", f: (q: number) => Math.min(q, 1 - q), color: "var(--series-3)" },
  ];
  return (
    <Panel
      title="Three ways to score how mixed a node is"
      footer={
        <>
          At p = {fmt(p, 3)}: entropy <span className="font-semibold tabular">{fmt(entropy(p), 3)}</span>, Gini{" "}
          <span className="font-semibold tabular" data-testid="ic-gini">{fmt(gini(p), 3)}</span>, misclassification {fmt(Math.min(p, 1 - p), 3)}.
        </>
      }
    >
      <Slider id="ic-p" label="Share of the node that stocks out (p)" value={p} min={0} max={1} step={0.005} onChange={setP} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Entropy, Gini and misclassification against p">
        <Axis scale={y} orient="left" at={44} gridTo={VW - 14} label="impurity" />
        <Axis scale={x} orient="bottom" at={H - 34} label="p" />
        {curves.map((c) => (
          <polyline key={c.name} points={ps.map((q) => `${x(q)},${y(c.f(q))}`).join(" ")} fill="none" stroke={c.color} strokeWidth={2} />
        ))}
        <line x1={x(p)} x2={x(p)} y1={12} y2={H - 34} stroke="var(--ink)" strokeDasharray="4 3" />
        {curves.map((c) => (
          <circle key={c.name} cx={x(p)} cy={y(c.f(p))} r={4} fill={c.color} stroke="var(--surface-1)" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {curves.map((c) => (
          <Key key={c.name} color={c.color} label={c.name} shape="line" />
        ))}
      </div>
    </Panel>
  );
}

/** Bagging: average trees grown on bootstrap resamples. Each tree is jumpy; the average is not. */
export function BaggingDemo() {
  const train = useMemo(() => storeWorld(120, 9), []);
  const test = useMemo(() => storeWorld(600, 10), []);
  const [count, setCount] = useState(1);
  const trees = useMemo(
    () =>
      Array.from({ length: 50 }, (_, b) => {
        const rng = mulberry32(500 + b);
        const idx = train.X.map(() => Math.floor(rng() * train.X.length));
        return fitTree(
          idx.map((i) => train.X[i]),
          idx.map((i) => train.y[i]),
          { maxDepth: 8 },
        );
      }),
    [train],
  );
  // Running test error as trees are added: average the first B trees' predictions.
  const curve = useMemo(() => {
    const sums = test.X.map(() => 0);
    return trees.map((t, b) => {
      test.X.forEach((r, i) => (sums[i] += predictTree(t, r)));
      return Math.sqrt(test.X.reduce((s, _, i) => s + (sums[i] / (b + 1) - test.y[i]) ** 2, 0) / test.X.length);
    });
  }, [trees, test]);
  const cells = useMemo(() => {
    const out: { a: number; d: number; v: number }[] = [];
    for (let i = 0; i < 30; i++)
      for (let j = 0; j < 20; j++) {
        const r = [10 + i + 0.5, j + 0.5];
        out.push({ a: r[0], d: r[1], v: trees.slice(0, count).reduce((s, t) => s + predictTree(t, r), 0) / count });
      }
    return out;
  }, [trees, count]);
  const lo = Math.min(...train.y);
  const hi = Math.max(...train.y);
  const x = linear([10, 40], [56, VW - 14]);
  const y = linear([0, 20], [H - 34, 12]);
  const ex = linear([1, 50], [56, VW - 14]);
  const ey = linear([8, 12], [H - 34, 12]);
  return (
    <Panel
      title="Two bootstrap samples give two different trees. Averaging many of them is a random forest's core idea."
      footer={
        <>
          Average of {count} depth-8 {count === 1 ? "tree" : "trees"}: test error{" "}
          <span className="font-semibold tabular" data-testid="bag-test">{fmt(curve[count - 1], 2)}</span> litres, against {fmt(curve[0], 2)} for one tree.
        </>
      }
    >
      <Slider id="bag-count" label="Trees averaged (each on its own bootstrap sample)" value={count} min={1} max={50} step={1} onChange={setCount} />
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Averaged prediction over floor area and distance">
          {cells.map((c, i) => (
            <rect key={i} x={x(c.a - 0.5)} y={y(c.d + 0.5)} width={x(1) - x(0) + 0.5} height={y(0) - y(1) + 0.5} fill={seqColor(c.v, lo, hi)} fillOpacity={0.6} />
          ))}
          <Axis scale={x} orient="bottom" at={H - 34} label="floor area (thousand sq ft)" />
          <Axis scale={y} orient="left" at={56} label="km to centre" />
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Test error as more trees are averaged">
          <Axis scale={ey} orient="left" at={56} gridTo={VW - 14} label="test error" />
          <Axis scale={ex} orient="bottom" at={H - 34} label="trees averaged" />
          <polyline points={curve.map((v, i) => `${ex(i + 1)},${ey(Math.min(12, v))}`).join(" ")} fill="none" stroke="var(--series-2)" strokeWidth={2} />
          <circle cx={ex(count)} cy={ey(Math.min(12, curve[count - 1]))} r={5} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-550)" label="Averaged prediction (darker = more)" shape="bar" />
        <Key color="var(--series-2)" label="Test error on 600 new stores" shape="line" />
      </div>
    </Panel>
  );
}

"use client";

import { useMemo, useState } from "react";
import { mulberry32, normal } from "@/lib/sim/rng";
import { fitTree, leafImpurity, leaves, regions, splitCandidates, treeDepth } from "@/lib/sim/tree";
import { goss, naiveTargetEncoding, orderedTargetStats, quantileCuts } from "@/lib/sim/xgb";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 240;
const L = 52;
const B = H - 34;

// Eight weeks of a tile adhesive: price (₹) and units sold.
export const HIST_PRICE = [120, 135, 150, 210, 220, 380, 400, 640];
export const HIST_UNITS = [30, 28, 27, 20, 19, 12, 11, 5];

/** Exact split search tries every gap; histogram search only tries the bin edges. */
export function HistogramSplit() {
  const [bins, setBins] = useState(4);
  const X = HIST_PRICE.map((p) => [p]);
  const exact = splitCandidates(X, HIST_UNITS, X.map((_, i) => i));
  const best = exact.reduce((a, b) => (b.gain > a.gain ? b : a));
  const cuts = quantileCuts(HIST_PRICE, bins);
  const histCands = exact.filter((c) => cuts.includes(c.threshold));
  const histBest = histCands.reduce((a, b) => (b.gain > a.gain ? b : a), histCands[0]);
  const x = linear([100, 660], [L, VW - 14]);
  const y = linear([0, 35], [B, 12]);
  return (
    <Panel
      title="Exact vs histogram split search on eight weeks"
      footer={
        <>
          Exact search tries {exact.length} thresholds and finds ₹{best.threshold} (gain {fmt(best.gain, 2)}). With {bins} bins it tries{" "}
          {cuts.length} and finds ₹{histBest.threshold} (gain{" "}
          <span className="font-semibold tabular" data-testid="hs-gain">{fmt(histBest.gain, 2)}</span>, {fmt((100 * histBest.gain) / best.gain, 0)}% of the best).
        </>
      }
    >
      <Slider id="hs-bins" label="Number of bins" value={bins} min={2} max={8} step={1} onChange={setBins} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Weeks by price with exact candidate thresholds and bin edges">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="units" />
        <Axis scale={x} orient="bottom" at={B} format={(v) => `₹${v}`} label="price" />
        {exact.map((c) => (
          <line key={c.threshold} x1={x(c.threshold)} x2={x(c.threshold)} y1={12} y2={B} stroke="var(--muted)" strokeDasharray="2 3" />
        ))}
        {cuts.map((c) => (
          <line key={c} x1={x(c)} x2={x(c)} y1={12} y2={B} stroke="var(--series-2)" strokeWidth={2} />
        ))}
        <line x1={x(best.threshold)} x2={x(best.threshold)} y1={12} y2={B} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="6 3" />
        {HIST_PRICE.map((p, i) => (
          <circle key={i} cx={x(p)} cy={y(HIST_UNITS[i])} r={5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--muted)" label="Every exact candidate" shape="line" />
        <Key color="var(--series-2)" label="Bin edges (the only candidates in histogram mode)" shape="line" />
        <Key color="var(--ink)" label="Best exact split" shape="line" />
      </div>
    </Panel>
  );
}

// Ten rows' gradients: two large, eight small.
export const GOSS_G = [-9, 7, -0.6, 0.5, -0.4, 0.3, -0.2, 0.6, -0.5, 0.4];

/** GOSS keeps the big gradients and a reweighted sample of the small ones. On average it gets the sum right. */
export function GossDemo() {
  const [a, setA] = useState(0.2);
  const [b, setB] = useState(0.2);
  const [seed, setSeed] = useState(1);
  const trueG = GOSS_G.reduce((s, v) => s + v, 0);
  const one = goss(GOSS_G, a, b, mulberry32(seed));
  const est = one.rows.reduce((s, r, k) => s + GOSS_G[r] * one.weights[k], 0);
  const many = useMemo(() => {
    const rng = mulberry32(99);
    return Array.from({ length: 2000 }, () => {
      const s = goss(GOSS_G, a, b, rng);
      return s.rows.reduce((t, r, k) => t + GOSS_G[r] * s.weights[k], 0);
    });
  }, [a, b]);
  const avg = many.reduce((s, v) => s + v, 0) / many.length;
  const lo = -7;
  const hi = 3;
  const nb = 40;
  const counts = Array.from({ length: nb }, (_, k) => many.filter((v) => v >= lo + ((hi - lo) * k) / nb && v < lo + ((hi - lo) * (k + 1)) / nb).length);
  const x = linear([lo, hi], [L, VW - 14]);
  const y = linear([0, Math.max(...counts) * 1.1], [B, 12]);
  return (
    <Panel
      title="GOSS: keep the rows the model is most wrong about, sample the rest"
      footer={
        <>
          This draw uses {one.rows.length} of 10 rows and estimates G = <span className="font-semibold tabular">{fmt(est, 2)}</span> (true {fmt(trueG, 2)}). Over
          2,000 draws the estimates average <span className="font-semibold tabular" data-testid="goss-avg">{fmt(avg, 2)}</span>: unbiased, just noisy.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="goss-a" label="a: share kept by largest |gradient|" value={a} min={0.1} max={0.5} step={0.1} onChange={setA} display={(v) => fmt(v, 1)} />
        <Slider id="goss-b" label="b: share sampled from the rest" value={b} min={0.1} max={0.5} step={0.1} onChange={setB} display={(v) => fmt(v, 1)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {GOSS_G.map((g, i) => {
          const k = one.rows.indexOf(i);
          return (
            <span
              key={i}
              className={`rounded-md px-2 py-1 text-xs tabular ${k >= 0 ? (one.weights[k] === 1 ? "bg-accent text-white" : "bg-accent-wash text-ink") : "bg-surface-2 text-muted line-through"}`}
            >
              {g > 0 ? "+" : ""}
              {g}
              {k >= 0 && one.weights[k] !== 1 && ` ×${fmt(one.weights[k], 1)}`}
            </span>
          );
        })}
        <button type="button" onClick={() => setSeed((s) => s + 1)} className="ml-2 rounded-lg border border-line px-3 py-1 text-xs hover:border-accent">
          Sample again
        </button>
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of GOSS estimates of the gradient sum">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="draws" />
        <Axis scale={x} orient="bottom" at={B} label="estimated gradient sum G" />
        {counts.map((c, k) => (
          <rect key={k} x={x(lo + ((hi - lo) * k) / nb) + 0.5} y={y(c)} width={x((hi - lo) / nb) - x(0) - 1} height={B - y(c)} fill="var(--seq-250)" />
        ))}
        <line x1={x(trueG)} x2={x(trueG)} y1={12} y2={B} stroke="var(--ink)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--accent)" label="Kept (large gradient, weight 1)" shape="bar" />
        <Key color="var(--accent-wash)" label="Sampled small gradient, up-weighted" shape="bar" />
        <Key color="var(--ink)" label="True sum" shape="line" />
      </div>
    </Panel>
  );
}

function storeWorld(n: number, seed: number) {
  const rng = mulberry32(seed);
  const X = Array.from({ length: n }, () => [10 + rng() * 30, rng() * 20]);
  const y = X.map(([a, d]) => 30 + 2 * a - 1.5 * d + (a > 25 && d < 8 ? 15 : 0) + normal(rng, 0, 8));
  return { X, y };
}

const SEQ = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];

/** XGBoost grows level by level; LightGBM grows the single best leaf next. */
export function LevelVsLeaf() {
  const data = useMemo(() => storeWorld(120, 9), []);
  const [n, setN] = useState(12);
  const trees = (["depth", "leaf"] as const).map((growth) => fitTree(data.X, data.y, { growth, maxLeaves: n, maxDepth: 30 }));
  const lo = Math.min(...data.y);
  const hi = Math.max(...data.y);
  const x = linear([10, 40], [40, 216]);
  const y = linear([0, 20], [176, 8]);
  return (
    <Panel
      title="Same 120 stores, same number of leaves, two growth orders"
      footer={
        <>
          With {n} leaves: level-wise depth {treeDepth(trees[0])}, training error {fmt(leafImpurity(trees[0]), 0)}; leaf-wise depth{" "}
          <span className="font-semibold tabular" data-testid="lvl-depth">{treeDepth(trees[1])}</span>, training error {fmt(leafImpurity(trees[1]), 0)}.
        </>
      }
    >
      <Slider id="lvl-leaves" label="Leaves" value={n} min={2} max={16} step={1} onChange={setN} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        {trees.map((t, k) => (
          <div key={k}>
            <div className="text-sm font-medium">{k === 0 ? "Level-wise (XGBoost default)" : "Leaf-wise (LightGBM)"}</div>
            <svg viewBox="0 0 224 200" className="h-auto w-full" role="img" aria-label={`${k === 0 ? "Level-wise" : "Leaf-wise"} partition with ${leaves(t).length} leaves`}>
              {regions(t, [10, 0], [40, 20]).map((r) => (
                <rect
                  key={r.id}
                  x={x(r.lo[0])}
                  y={y(r.hi[1])}
                  width={x(r.hi[0]) - x(r.lo[0])}
                  height={y(r.lo[1]) - y(r.hi[1])}
                  fill={SEQ[Math.max(0, Math.min(4, Math.floor(((r.value - lo) / (hi - lo)) * 5)))]}
                  fillOpacity={0.6}
                  stroke="var(--surface-1)"
                  strokeWidth={1.5}
                />
              ))}
              {data.X.map(([a, d], i) => (
                <circle key={i} cx={x(a)} cy={y(d)} r={1.6} fill="var(--ink)" fillOpacity={0.6} />
              ))}
              <text x={40} y={196} fontSize={10} fill="var(--muted)">
                floor area →
              </text>
            </svg>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-550)" label="Leaf prediction (darker = more)" shape="bar" />
      </div>
    </Panel>
  );
}

// Six rows of a promo-response table: which store, and whether the promo beat target.
export const TS_STORES = ["A", "B", "A", "C", "B", "A"];
export const TS_BEAT = [1, 0, 1, 1, 0, 0];

/** Naive target encoding lets each row see its own answer; ordered statistics only look backwards. */
export function TargetLeakage() {
  const [nStores, setNStores] = useState(400);
  const naive = naiveTargetEncoding(TS_STORES, TS_BEAT);
  const ordered = orderedTargetStats(TS_STORES, TS_BEAT, 0.5, 1);
  // A pure-noise store id: 800 rows, nStores levels, target unrelated to the store.
  const result = useMemo(() => {
    const rng = mulberry32(17);
    const mk = (n: number) => {
      const cats = Array.from({ length: n }, () => `s${Math.floor(rng() * nStores)}`);
      const y = cats.map(() => (rng() < 0.5 ? 1 : 0));
      return { cats, y };
    };
    const train = mk(800);
    const test = mk(800);
    const prior = 0.5;
    // Test rows are encoded with the training rows' statistics, as in production.
    const stats = new Map<string, { s: number; c: number }>();
    train.cats.forEach((c, i) => {
      const e = stats.get(c) ?? { s: 0, c: 0 };
      stats.set(c, { s: e.s + train.y[i], c: e.c + 1 });
    });
    const encodeTest = test.cats.map((c) => {
      const e = stats.get(c);
      return e ? (e.s + prior) / (e.c + 1) : prior;
    });
    const acc = (enc: number[], y: number[]) => enc.filter((v, i) => (v > 0.5 ? 1 : 0) === y[i]).length / y.length;
    // CatBoost walks the rows in a random order (a Fisher–Yates shuffle here).
    const rng2 = mulberry32(3);
    const perm = train.cats.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rng2() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    return {
      naiveTrain: acc(naiveTargetEncoding(train.cats, train.y), train.y),
      orderedTrain: acc(orderedTargetStats(train.cats, train.y, prior, 1, perm), train.y),
      test: acc(encodeTest, test.y),
    };
  }, [nStores]);
  return (
    <Panel
      title="Target encoding a store ID that carries no signal at all"
      footer={
        <>
          Predicting “beat target” from the encoded store ID alone: naive encoding scores{" "}
          <span className="font-semibold tabular" data-testid="tl-naive">{Math.round(result.naiveTrain * 100)}%</span> on training rows, ordered statistics{" "}
          <span className="font-semibold tabular" data-testid="tl-ordered">{Math.round(result.orderedTrain * 100)}%</span>, and new rows get{" "}
          {Math.round(result.test * 100)}%. The truth is a coin flip, so anything far above 50% is leakage.
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead className="text-left text-xs text-ink-2">
            <tr>
              <th className="py-1 pr-3 font-medium">Row</th>
              <th className="py-1 pr-3 font-medium">Store</th>
              <th className="py-1 pr-3 font-medium">Beat target</th>
              <th className="py-1 pr-3 font-medium">Naive encoding</th>
              <th className="py-1 font-medium">Ordered (prior 0.5)</th>
            </tr>
          </thead>
          <tbody>
            {TS_STORES.map((s, i) => (
              <tr key={i}>
                <td className="border-t border-line py-1 pr-3">{i + 1}</td>
                <td className="border-t border-line py-1 pr-3">{s}</td>
                <td className="border-t border-line py-1 pr-3">{TS_BEAT[i]}</td>
                <td className="border-t border-line py-1 pr-3">{fmt(naive[i], 3)}</td>
                <td className="border-t border-line py-1">{fmt(ordered[i], 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Slider id="tl-stores" label="Number of distinct store IDs among 800 rows" value={nStores} min={10} max={800} step={10} onChange={setNStores} />
      </div>
    </Panel>
  );
}

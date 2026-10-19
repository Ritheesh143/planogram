"use client";

import { useMemo, useState } from "react";
import { predictMLP, trainMLP } from "@/lib/sim/mlp";
import { mulberry32, normal } from "@/lib/sim/rng";
import { fitTree, leaves, predictTree } from "@/lib/sim/tree";
import { fmt, Key, linear, Panel, Slider } from "./kit";

// Two kinds of store-sales surface over floor area (10–40k sq ft) and distance to the centre (0–20 km).
export const SURFACES = {
  oblique: { name: "Smooth, diagonal effect", f: (a: number, d: number) => 20 + 2 * a - 3 * d },
  steps: { name: "Jumps at thresholds", f: (a: number, d: number) => 40 + 30 * (a > 25 ? 1 : 0) + 20 * (d < 8 ? 1 : 0) },
};
export type SurfaceKind = keyof typeof SURFACES;

export function surfaceData(kind: SurfaceKind, n: number, seed: number) {
  const rng = mulberry32(seed);
  const X = Array.from({ length: n }, () => [10 + rng() * 30, rng() * 20]);
  return { X, y: X.map(([a, d]) => SURFACES[kind].f(a, d) + normal(rng, 0, 5)) };
}

const SEQ = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];

export function BoxesVsBends() {
  const [kind, setKind] = useState<SurfaceKind>("oblique");
  const [depth, setDepth] = useState(4);
  const [hidden, setHidden] = useState(4);
  const train = useMemo(() => surfaceData(kind, 100, 1), [kind]);
  const test = useMemo(() => surfaceData(kind, 500, 2), [kind]);
  const tree = useMemo(() => fitTree(train.X, train.y, { maxDepth: depth }), [train, depth]);
  const mlp = useMemo(() => trainMLP(train.X, train.y, { hidden: [hidden], epochs: 800, lr: 0.02, seed: 3 }).model, [train, hidden]);
  const models = [
    { name: `Tree, depth ${depth} (${leaves(tree).length} boxes)`, p: (r: number[]) => predictTree(tree, r), id: "tree" },
    { name: `MLP, ${hidden} ReLU units`, p: (r: number[]) => predictMLP(mlp, r), id: "mlp" },
  ];
  const rmse = (p: (r: number[]) => number) => Math.sqrt(test.X.reduce((s, r, i) => s + (p(r) - test.y[i]) ** 2, 0) / test.X.length);
  const lo = Math.min(...train.y);
  const hi = Math.max(...train.y);
  const x = linear([10, 40], [8, 216]);
  const y = linear([0, 20], [168, 8]);
  const truth = (a: number, d: number) => SURFACES[kind].f(a, d);
  return (
    <Panel
      title="The same 100 stores, fitted by boxes and by bends"
      footer={
        <>
          Test error on 500 new stores: tree <span className="font-semibold tabular" data-testid="bb-tree">{fmt(rmse(models[0].p), 1)}</span>, MLP{" "}
          <span className="font-semibold tabular" data-testid="bb-mlp">{fmt(rmse(models[1].p), 1)}</span>. Noise alone is 5.
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="True sales surface">
        {(Object.keys(SURFACES) as SurfaceKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={kind === k ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {SURFACES[k].name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Slider id="bb-depth" label="Tree depth" value={depth} min={1} max={8} step={1} onChange={setDepth} />
        <Slider id="bb-hidden" label="MLP hidden units" value={hidden} min={2} max={16} step={2} onChange={setHidden} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[{ name: "The truth", p: (r: number[]) => truth(r[0], r[1]), id: "truth" }, ...models].map((m) => (
          <div key={m.id}>
            <div className="text-xs font-medium sm:text-sm">{m.name}</div>
            <svg viewBox="0 0 224 176" className="h-auto w-full" role="img" aria-label={`${m.name}: predicted sales over area and distance`}>
              {Array.from({ length: 30 }, (_, i) =>
                Array.from({ length: 20 }, (_, j) => {
                  const v = m.p([10 + i + 0.5, j + 0.5]);
                  const bin = Math.max(0, Math.min(4, Math.floor(((v - lo) / (hi - lo)) * 5)));
                  return <rect key={`${i}-${j}`} x={x(10 + i)} y={y(j + 1)} width={x(11) - x(10) + 0.4} height={y(0) - y(1) + 0.4} fill={SEQ[bin]} />;
                }),
              )}
            </svg>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-550)" label="Predicted sales (darker = more); floor area runs left to right, distance bottom to top" shape="bar" />
      </div>
    </Panel>
  );
}

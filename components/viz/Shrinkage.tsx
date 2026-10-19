"use client";

import { useMemo, useState } from "react";
import { normalNormal, normalPdf } from "@/lib/sim/bayes";
import { chainWorld, shrinkAll, sse } from "@/lib/sim/pooling";
import { mulberry32 } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

// The chain's stores average 50 litres a week with a store-to-store sd of 10 (variance 100).
// A store's weeks scatter around its own mean with sd 20 (variance 400). The new store averaged 30.
export const SH_PRIOR_MEAN = 50;
export const SH_PRIOR_VAR = 100;
export const SH_WEEK_VAR = 400;
export const SH_NEW_STORE_MEAN = 30;

const VW = 460;
const H = 250;
const L = 48;
const B = H - 34;

export function NewStoreShrinkage() {
  const [weeks, setWeeks] = useState(2);
  const post = normalNormal(SH_PRIOR_MEAN, SH_PRIOR_VAR, SH_NEW_STORE_MEAN, SH_WEEK_VAR, weeks);
  const dataSd = Math.sqrt(SH_WEEK_VAR / weeks);
  const postSd = Math.sqrt(post.variance);
  const x = linear([0, 90], [L, VW - 14]);
  const curves = [
    { name: "Prior: what the chain says about any store", m: SH_PRIOR_MEAN, s: Math.sqrt(SH_PRIOR_VAR), color: "var(--series-1)" },
    { name: `Data: ${weeks} ${weeks === 1 ? "week" : "weeks"} averaging ${SH_NEW_STORE_MEAN}`, m: SH_NEW_STORE_MEAN, s: dataSd, color: "var(--series-2)" },
    { name: "Posterior: what to believe about this store", m: post.mean, s: postSd, color: "var(--series-3)" },
  ];
  const peak = Math.max(...curves.map((c) => normalPdf(c.m, c.m, c.s)));
  const y = linear([0, peak * 1.1], [B, 12]);
  const xs = Array.from({ length: 181 }, (_, i) => i * 0.5);
  const path = (m: number, s: number) => xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(normalPdf(v, m, s)).toFixed(1)}`).join("");
  return (
    <Panel
      title="A new store's first weeks, combined with what the chain already knows"
      footer={
        <>
          With {weeks} {weeks === 1 ? "week" : "weeks"} of data, the data get{" "}
          <span className="font-semibold tabular" data-testid="sh-weight">{fmt(post.weightOnData * 100, 0)}%</span> of the weight and the chain
          gets {fmt((1 - post.weightOnData) * 100, 0)}%. Best estimate for this store:{" "}
          <span className="font-semibold tabular" data-testid="sh-post">{post.mean.toFixed(2)}</span> litres a week (posterior sd {postSd.toFixed(2)}), not the raw{" "}
          {SH_NEW_STORE_MEAN}.
        </>
      }
    >
      <Slider id="sh-weeks" label="Weeks of sales seen at the new store" value={weeks} min={1} max={20} step={1} onChange={setWeeks} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`Prior, data and posterior for the new store after ${weeks} weeks`}>
        <Axis scale={x} orient="bottom" at={B} label="the store's true average sales (litres / week)" />
        {curves.map((c) => (
          <path key={c.name} d={path(c.m, c.s)} fill="none" stroke={c.color} strokeWidth={c.color === "var(--series-3)" ? 3 : 2} />
        ))}
        <defs>
          <marker id="sh-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0L10,5L0,10z" fill="var(--ink)" />
          </marker>
        </defs>
        {Math.abs(post.mean - SH_NEW_STORE_MEAN) > 0.5 && (
          <line x1={x(SH_NEW_STORE_MEAN)} x2={x(post.mean)} y1={B - 14} y2={B - 14} stroke="var(--ink)" strokeWidth={1.5} markerEnd="url(#sh-arrow)" />
        )}
        <text x={x(SH_NEW_STORE_MEAN)} y={B - 20} fontSize={11} textAnchor="end" fill="var(--ink-2)">
          raw {SH_NEW_STORE_MEAN}
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {curves.map((c) => (
          <Key key={c.name} color={c.color} label={c.name} shape="line" />
        ))}
      </div>
    </Panel>
  );
}

// The same 40 stores as rung 9: true means from N(50, 10²), 1 to 52 weeks of history each.
export const SH_CHAIN_SEED = 1;

export function ShrinkageScatter() {
  const chain = useMemo(() => chainWorld(mulberry32(SH_CHAIN_SEED)), []);
  const shrunk = useMemo(() => shrinkAll(chain, SH_PRIOR_MEAN, SH_PRIOR_VAR, SH_WEEK_VAR), [chain]);
  const [show, setShow] = useState<"raw" | "both" | "shrunk">("both");
  const x = linear([20, 80], [L, VW - 14]);
  const y = linear([0, 100], [B, 12]);
  const fewWeeks = (j: number) => chain.n[j] <= 4;
  return (
    <Panel
      title="40 stores: each store's own average vs its shrunk estimate, against the planted truth"
      footer={
        <>
          Total squared error against the true store means: raw averages{" "}
          <span className="font-semibold tabular" data-testid="sh-raw-sse">{Math.round(sse(chain.ybar, chain.theta)).toLocaleString("en-IN")}</span>, shrunk{" "}
          <span className="font-semibold tabular" data-testid="sh-shrunk-sse">{Math.round(sse(shrunk, chain.theta)).toLocaleString("en-IN")}</span>.
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which estimates to show">
        {(
          [
            ["raw", "Raw averages"],
            ["both", "Both, with arrows"],
            ["shrunk", "Shrunk"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={show === k}
            onClick={() => setShow(k)}
            className={show === k ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {label}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Estimates against true store means">
        <defs>
          <marker id="shs-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0L10,5L0,10z" fill="var(--muted)" />
          </marker>
        </defs>
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="estimate" />
        <Axis scale={x} orient="bottom" at={B} label="true store mean (planted)" />
        <line x1={x(20)} y1={y(20)} x2={x(80)} y2={y(80)} stroke="var(--axis)" strokeDasharray="5 4" />
        <line x1={L} x2={VW - 14} y1={y(SH_PRIOR_MEAN)} y2={y(SH_PRIOR_MEAN)} stroke="var(--series-1)" strokeDasharray="3 3" />
        {show === "both" &&
          chain.theta.map((t, j) => (
            <line key={`a${j}`} x1={x(t)} x2={x(t)} y1={y(chain.ybar[j])} y2={y(shrunk[j])} stroke="var(--muted)" strokeWidth={1} markerEnd="url(#shs-arrow)" />
          ))}
        {show !== "shrunk" &&
          chain.theta.map((t, j) => (
            <circle key={`r${j}`} cx={x(t)} cy={y(Math.max(0, Math.min(100, chain.ybar[j])))} r={fewWeeks(j) ? 4 : 3} fill="none" stroke="var(--series-2)" strokeWidth={1.5} />
          ))}
        {show !== "raw" && chain.theta.map((t, j) => <circle key={`s${j}`} cx={x(t)} cy={y(shrunk[j])} r={fewWeeks(j) ? 4 : 3} fill="var(--series-3)" />)}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-2)" label="Store's own average (raw)" />
        <Key color="var(--series-3)" label="Shrunk toward the chain" />
        <Key color="var(--axis)" label="Perfect estimate (on the diagonal)" shape="line" />
        <Key color="var(--series-1)" label="Chain average, 50" shape="line" />
        <span className="text-xs text-ink-2">Larger markers: stores with 4 weeks of history or less.</span>
      </div>
    </Panel>
  );
}

/** 1,000 chains of 40 stores: how often does shrinking beat each store's own average? */
export function ShrinkageSimulation() {
  const [seed, setSeed] = useState(99);
  const runs = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: 1000 }, () => {
      const c = chainWorld(rng);
      return { raw: sse(c.ybar, c.theta), shrunk: sse(shrinkAll(c, SH_PRIOR_MEAN, SH_PRIOR_VAR, SH_WEEK_VAR), c.theta) };
    });
  }, [seed]);
  const wins = runs.filter((r) => r.shrunk < r.raw).length;
  const avgRaw = runs.reduce((s, r) => s + r.raw, 0) / runs.length;
  const avgShrunk = runs.reduce((s, r) => s + r.shrunk, 0) / runs.length;
  const ratios = runs.map((r) => r.shrunk / r.raw);
  const nb = 24;
  const counts = Array.from({ length: nb }, (_, k) => ratios.filter((v) => v >= (k * 1.2) / nb && v < ((k + 1) * 1.2) / nb).length);
  const x = linear([0, 1.2], [L, VW - 14]);
  const y = linear([0, Math.max(...counts) * 1.1], [B, 12]);
  return (
    <Panel
      title="1,000 chains, each with 40 stores and planted true means"
      footer={
        <>
          Shrinking beat the raw averages in <span className="font-semibold tabular" data-testid="sh-wins">{wins.toLocaleString("en-IN")} of 1,000</span> chains. Average total squared
          error: raw {Math.round(avgRaw).toLocaleString("en-IN")}, shrunk {Math.round(avgShrunk).toLocaleString("en-IN")}.
        </>
      }
    >
      <button type="button" onClick={() => setSeed((s) => s + 1)} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white">
        Simulate 1,000 new chains
      </button>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of shrunk error divided by raw error">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="chains" />
        <Axis scale={x} orient="bottom" at={B} label="shrunk error ÷ raw error (below 1 = shrinking won)" />
        {counts.map((c, k) => (
          <rect key={k} x={x((k * 1.2) / nb) + 0.5} y={y(c)} width={x(1.2 / nb) - x(0) - 1} height={B - y(c)} fill="var(--seq-400)" />
        ))}
        <line x1={x(1)} x2={x(1)} y1={12} y2={B} stroke="var(--ink)" strokeWidth={1.5} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-400)" label="Chains" shape="bar" />
        <Key color="var(--ink)" label="Break-even" shape="line" />
      </div>
    </Panel>
  );
}

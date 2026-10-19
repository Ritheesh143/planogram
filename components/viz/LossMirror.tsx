"use client";

import { useMemo, useState } from "react";
import { nll, type NoiseModel } from "@/lib/sim/losses";
import { mulberry32, negBinomial } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

// Three days of a slow-moving SKU, plus an optional spike day.
export const LM_DAYS = [2, 3, 7];
export const LM_SPIKE = 15;
// Noise scale shown for the Gaussian (σ) and Laplace (b) models. It moves the curves, never the minimum.
const SCALE = 2;

const MODELS: { id: NoiseModel; name: string; loss: string }[] = [
  { id: "gaussian", name: "Gaussian", loss: "squared error" },
  { id: "laplace", name: "Laplace", loss: "absolute error" },
  { id: "poisson", name: "Poisson", loss: "Poisson deviance" },
];

const VW = 460;
const H = 190;
const L = 56;

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function LossMirror() {
  const [model, setModel] = useState<NoiseModel>("gaussian");
  const [mu, setMu] = useState(5);
  const [spike, setSpike] = useState(false);
  const data = spike ? [...LM_DAYS, LM_SPIKE] : LM_DAYS;

  const grid = useMemo(() => Array.from({ length: 321 }, (_, i) => 0.25 + i * 0.05), []);
  const losses = grid.map((m) => nll(model, data, m, SCALE));
  const minLoss = Math.min(...losses);
  // Where the loss is (numerically) at its minimum: a point, or a flat stretch for Laplace with even n.
  const flat = grid.filter((_, i) => losses[i] - minLoss < 1e-9);
  const best = [flat[0], flat[flat.length - 1]];
  const rel = losses.map((v) => Math.exp(minLoss - v));
  const cur = nll(model, data, mu, SCALE);
  const curRel = Math.exp(minLoss - cur);

  const x = linear([0, 16.25], [L, VW - 14]);
  const yl = linear([0, 1], [H - 30, 12]);
  const maxShown = minLoss + 12;
  const yn = linear([minLoss - 0.5, maxShown], [H - 30, 12]);
  const path = (vals: number[], y: (v: number) => number, cap?: number) =>
    grid.map((m, i) => `${i ? "L" : "M"}${x(m).toFixed(1)},${y(cap === undefined ? vals[i] : Math.min(cap, vals[i])).toFixed(1)}`).join("");
  const info = MODELS.find((m) => m.id === model)!;

  return (
    <Panel
      title="The likelihood's peak and the loss's valley are the same point"
      footer={
        <>
          Days: {data.join(", ")}. Mean {fmt(data.reduce((a, b) => a + b, 0) / data.length, 2)}, median {fmt(median(data), 1)}. The {info.name} likelihood peaks at{" "}
          <span className="font-semibold tabular" data-testid="lm-argmin">
            {best[1] - best[0] < 0.06 ? fmt(Math.round(best[0] * 100) / 100, 2) : `anywhere from ${fmt(best[0], 2)} to ${fmt(best[1], 2)}`}
          </span>
          . At μ = {fmt(mu, 2)} the negative log-likelihood is <span className="font-semibold tabular" data-testid="lm-nll">{fmt(cur, 3)}</span>.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Noise model">
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={model === m.id}
            onClick={() => setModel(m.id)}
            className={model === m.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {m.name} noise ↔ {m.loss}
          </button>
        ))}
      </div>
      <div className="mt-3 grid items-end gap-4 sm:grid-cols-2">
        <Slider id="lm-mu" label="Your prediction μ (units per day)" value={mu} min={0.5} max={16} step={0.25} onChange={setMu} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spike} onChange={(e) => setSpike(e.target.checked)} /> Add a {LM_SPIKE}-unit spike day
        </label>
      </div>

      <div className="mt-3 text-xs font-medium text-ink-2">Likelihood of the data at each μ (relative to its peak)</div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label={`Relative ${info.name} likelihood against μ`}>
        <Axis scale={yl} orient="left" at={L} gridTo={VW - 14} tickValues={[0, 0.5, 1]} />
        <Axis scale={x} orient="bottom" at={H - 30} />
        {data.map((d, i) => (
          <line key={i} x1={x(d)} x2={x(d)} y1={H - 30} y2={H - 38} stroke="var(--ink)" strokeWidth={2} />
        ))}
        <path d={path(rel, yl)} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <line x1={x(mu)} x2={x(mu)} y1={12} y2={H - 30} stroke="var(--ink)" strokeDasharray="4 3" />
        <circle cx={x(mu)} cy={yl(curRel)} r={5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
      </svg>
      <div className="text-xs font-medium text-ink-2">Loss = negative log-likelihood (lower is better)</div>
      <svg viewBox={`0 0 ${VW} ${H + 12}`} className="h-auto w-full" role="img" aria-label={`${info.loss} as negative log-likelihood against μ`}>
        <defs>
          <clipPath id="lm-loss">
            <rect x={L} y={12} width={VW - 14 - L} height={H - 42} />
          </clipPath>
        </defs>
        <Axis scale={yn} orient="left" at={L} gridTo={VW - 14} format={(v) => fmt(v, 0)} />
        <Axis scale={x} orient="bottom" at={H - 30} label="prediction μ" />
        <path d={path(losses, yn)} fill="none" stroke="var(--series-2)" strokeWidth={2} clipPath="url(#lm-loss)" />
        {best[1] - best[0] >= 0.06 && <line x1={x(best[0])} x2={x(best[1])} y1={yn(minLoss)} y2={yn(minLoss)} stroke="var(--series-2)" strokeWidth={5} strokeLinecap="round" />}
        <line x1={x(mu)} x2={x(mu)} y1={12} y2={H - 30} stroke="var(--ink)" strokeDasharray="4 3" />
        <circle cx={x(mu)} cy={yn(Math.min(maxShown, cur))} r={5} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="A day's sales (tick on the axis)" shape="bar" />
        <Key color="var(--series-1)" label="Likelihood" shape="line" />
        <Key color="var(--series-2)" label={`Negative log-likelihood (${info.loss} plus a constant)`} shape="line" />
      </div>
    </Panel>
  );
}

const SKEWS = [0.3, 0.6, 1, 2, 5, 100];

function quantile(sorted: number[], q: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** 2,000 days of a slow mover: each loss's best constant lands on a different summary of the same data. */
export function LossSimulation() {
  const [skewIdx, setSkewIdx] = useState(0);
  const [seed, setSeed] = useState(3);
  const k = SKEWS[skewIdx];
  const days = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: 2000 }, () => negBinomial(rng, 2, k));
  }, [k, seed]);
  const sorted = useMemo(() => [...days].sort((a, b) => a - b), [days]);
  const mean = days.reduce((a, b) => a + b, 0) / days.length;
  const med = quantile(sorted, 0.5);
  const p90 = quantile(sorted, 0.9);
  const served = (stock: number) => days.filter((d) => d <= stock).length / days.length;

  const top = 15;
  const counts = Array.from({ length: top + 1 }, (_, v) => days.filter((d) => (v === top ? d >= top : d === v)).length);
  const x = linear([-0.5, top + 0.5], [L, VW - 14]);
  const y = linear([0, Math.max(...counts) * 1.1], [H + 30, 12]);
  const lines = [
    { name: "Squared error → mean", v: mean, color: "var(--series-1)", id: "ls-mean" },
    { name: "Absolute error → median", v: med, color: "var(--series-2)", id: "ls-median" },
    { name: "Pinball τ = 0.9 → 90th percentile", v: p90, color: "var(--series-3)", id: "ls-p90" },
  ];

  return (
    <Panel title="2,000 days of a slow-moving SKU. Three losses, three different 'best' constants.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="ls-skew" label="Skew (lower k = more zeros and spikes)" value={skewIdx} min={0} max={SKEWS.length - 1} step={1} onChange={setSkewIdx} display={(i) => (SKEWS[i] >= 100 ? "k = ∞ (Poisson)" : `k = ${SKEWS[i]}`)} />
        <div className="flex items-end">
          <button type="button" onClick={() => setSeed((s) => s + 1)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
            Draw 2,000 new days
          </button>
        </div>
      </div>
      <svg viewBox={`0 0 ${VW} ${H + 64}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of daily sales with the mean, median and 90th percentile marked">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="days" />
        <Axis scale={x} orient="bottom" at={H + 30} tickValues={[0, 5, 10, 15]} format={(v) => (v === top ? `${top}+` : String(v))} label="units sold in a day" />
        {counts.map((c, v) => (
          <rect key={v} x={x(v - 0.4)} y={y(c)} width={x(0.8) - x(0)} height={y(0) - y(c)} fill="var(--seq-250)" />
        ))}
        {lines.map((l) => (
          <line key={l.id} x1={x(l.v)} x2={x(l.v)} y1={12} y2={H + 30} stroke={l.color} strokeWidth={2.5} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {lines.map((l) => (
          <Key key={l.id} color={l.color} label={l.name} shape="line" />
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead className="text-left text-xs text-ink-2">
            <tr>
              <th className="py-1 pr-3 font-medium">Loss you trained with</th>
              <th className="py-1 pr-3 font-medium">Best constant</th>
              <th className="py-1 font-medium">Days fully served if you stock that many</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="border-t border-line py-1 pr-3">{l.name}</td>
                <td className="border-t border-line py-1 pr-3 font-semibold" data-testid={l.id}>
                  {fmt(l.v, 2)}
                </td>
                <td className="border-t border-line py-1">{Math.round(served(Math.floor(l.v)) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

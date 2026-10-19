"use client";

import { useMemo, useState } from "react";
import { grid, normalNormal, normalPdf } from "@/lib/sim/bayes";
import { lognormalQuantile, repeatWorld, salesRecord, shareAbove, washOut, type GammaPrior } from "@/lib/sim/priors";
import { mulberry32, normal } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 240;
const L = 52;
const B = H - 34;

/** Readable big numbers: 13.9 million, 12.7 billion. */
export function bigNumber(v: number): string {
  const units: [number, string][] = [
    [1e12, "trillion"],
    [1e9, "billion"],
    [1e6, "million"],
  ];
  for (const [u, name] of units) if (v >= u) return `${fmt(Math.round((v / u) * 10) / 10, 1)} ${name}`;
  if (v >= 1000) return Math.round(v).toLocaleString("en-IN");
  if (v >= 10) return fmt(Math.round(v * 10) / 10, 1);
  return fmt(Math.round(v * 100) / 100, 2);
}

const MEDIANS = [0.1, 0.5, 1, 2, 5, 10];

/** What a prior on log(daily rate) claims about sales, before seeing any data. */
export function PriorPredictive() {
  const [mi, setMi] = useState(2);
  const [sd, setSd] = useState(10);
  const m = Math.log(MEDIANS[mi]);
  const draws = useMemo(() => {
    const rng = mulberry32(8);
    return Array.from({ length: 4000 }, () => normal(rng, m, sd) / Math.LN10);
  }, [m, sd]);
  const lo = -6;
  const hi = 12;
  const nb = 36;
  const counts = Array.from({ length: nb }, (_, i) => {
    const a = lo + ((hi - lo) * i) / nb;
    const b = lo + ((hi - lo) * (i + 1)) / nb;
    return draws.filter((v) => (i === 0 ? v < b : i === nb - 1 ? v >= a : v >= a && v < b)).length;
  });
  const x = linear([lo, hi], [L, VW - 14]);
  const y = linear([0, Math.max(...counts) * 1.1], [B, 12]);
  const p95 = lognormalQuantile(m, sd, 0.95);
  const p99 = lognormalQuantile(m, sd, 0.99);
  const absurd = shareAbove(m, sd, 1000);
  const preset = (median: number, s: number) => {
    setMi(MEDIANS.indexOf(median));
    setSd(s);
  };
  return (
    <Panel
      title="Prior predictive check: what does this prior say a store sells, before any data?"
      footer={
        <>
          Prior log λ ~ Normal(log {MEDIANS[mi]}, {fmt(sd, 2)}). Half of stores would average under {bigNumber(MEDIANS[mi])} {MEDIANS[mi] === 1 ? "drill" : "drills"} a day; 1 in 20 above{" "}
          <span className="font-semibold tabular" data-testid="pd-p95">{bigNumber(p95)}</span>; 1 in 100 above{" "}
          <span className="font-semibold tabular" data-testid="pd-p99">{bigNumber(p99)}</span>. Share of stores selling more than 1,000 drills a day:{" "}
          <span className="font-semibold tabular" data-testid="pd-absurd">{absurd < 0.0005 ? "essentially none" : `${fmt(absurd * 100, 1)}%`}</span>.
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => preset(1, 10)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
          “Vague”: Normal(0, 10)
        </button>
        <button type="button" onClick={() => preset(2, 1)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
          Weakly informative: Normal(log 2, 1)
        </button>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Slider id="pd-median" label="Prior median (drills a day)" value={mi} min={0} max={MEDIANS.length - 1} step={1} onChange={setMi} display={(i) => String(MEDIANS[i])} />
        <Slider id="pd-sd" label="Prior spread: sd of log λ" value={sd} min={0.25} max={10} step={0.25} onChange={setSd} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of implied average daily sales on a log scale">
        <rect x={x(Math.log10(0.5))} y={12} width={x(Math.log10(20)) - x(Math.log10(0.5))} height={B - 12} fill="var(--series-3)" fillOpacity={0.1} />
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="simulated stores" />
        <Axis
          scale={x}
          orient="bottom"
          at={B}
          tickValues={[-6, -3, 0, 3, 6, 9, 12]}
          format={(v) => (v === 0 ? "1" : v === 3 ? "1k" : v === 6 ? "1M" : v === 9 ? "1B" : v === 12 ? "1T" : `1e${v}`)}
          label="average drills a day (log scale)"
        />
        {counts.map((c, i) => (
          <rect key={i} x={x(lo + ((hi - lo) * i) / nb) + 0.5} y={y(c)} width={x((hi - lo) / nb) - x(0) - 1} height={B - y(c)} fill="var(--seq-400)" />
        ))}
        <line x1={x(3)} x2={x(3)} y1={12} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
        <text x={x(3) + 4} y={24} fontSize={11} fill="var(--ink-2)">
          1,000 a day
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-400)" label="4,000 stores drawn from the prior" shape="bar" />
        <Key color="var(--series-3)" label="Plausible for a home-improvement store (0.5–20 a day)" shape="bar" />
      </div>
    </Panel>
  );
}

export const WASH_PRIORS: GammaPrior[] = [
  { name: "Optimist: Gamma(30, 6), mean 5", shape: 30, rate: 6 },
  { name: "Defensible: Gamma(4, 2), mean 2", shape: 4, rate: 2 },
  { name: "Pessimist: Gamma(5, 10), mean 0.5", shape: 5, rate: 10 },
];
export const WASH_TRUE_RATE = 1.4;
const COLORS = ["var(--series-2)", "var(--series-1)", "var(--series-4)"];

/** Three analysts, three priors, one store's sales record: as days accumulate, they agree. */
export function WashOut() {
  const [n, setN] = useState(7);
  const record = useMemo(() => salesRecord(WASH_TRUE_RATE, 90), []);
  const paths = useMemo(() => washOut(WASH_PRIORS, record), [record]);
  const x = linear([0, 90], [L, VW - 14]);
  const y = linear([0, 5.2], [B, 12]);
  const avg = n ? record.slice(0, n).reduce((a, b) => a + b, 0) / n : null;
  return (
    <Panel
      title="Three priors, one store's sales. The data wash the priors out."
      footer={
        <>
          After {n} days the three posterior means are{" "}
          <span className="font-semibold tabular" data-testid="pd-wash">{paths.map((p) => fmt(p[n], 2)).join(", ")}</span>
          {avg !== null && `; the plain sample mean is ${fmt(avg, 2)}`}. The true rate is {WASH_TRUE_RATE}.
        </>
      }
    >
      <Slider id="pd-days" label="Days of sales observed" value={n} min={0} max={90} step={1} onChange={setN} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Posterior mean under three priors as days accumulate">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="posterior mean λ" />
        <Axis scale={x} orient="bottom" at={B} label="days of data" />
        <line x1={L} x2={VW - 14} y1={y(WASH_TRUE_RATE)} y2={y(WASH_TRUE_RATE)} stroke="var(--ink)" strokeDasharray="5 4" />
        {paths.map((p, j) => (
          <polyline key={j} points={p.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke={COLORS[j]} strokeWidth={2} />
        ))}
        <line x1={x(n)} x2={x(n)} y1={12} y2={B} stroke="var(--ink-2)" strokeDasharray="2 3" />
        {paths.map((p, j) => (
          <circle key={j} cx={x(n)} cy={y(p[n])} r={4.5} fill={COLORS[j]} stroke="var(--surface-1)" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {WASH_PRIORS.map((p, j) => (
          <Key key={p.name} color={COLORS[j]} label={p.name} shape="line" />
        ))}
        <Key color="var(--ink)" label="True rate" shape="line" />
      </div>
    </Panel>
  );
}

const DAYS = [1, 3, 7, 14, 30, 60];

/** Repeat the world: 2,000 new stores, each estimated three ways. */
export function RepeatWorld() {
  const [di, setDi] = useState(1);
  const days = DAYS[di];
  const r = useMemo(() => repeatWorld(days, WASH_PRIORS[1], WASH_PRIORS[0]), [days]);
  const bars = [
    { name: "Sample mean (no prior)", v: r.mle, color: "var(--series-7)" },
    { name: "Defensible prior, Gamma(4, 2)", v: r.defensible, color: "var(--series-1)" },
    { name: "Confidently wrong prior, Gamma(30, 6)", v: r.wrong, color: "var(--series-2)" },
  ];
  const x = linear([0, 2.7], [8, VW - 60]);
  return (
    <Panel
      title="2,000 new stores whose true rates follow the chain. How wrong is each estimate?"
      footer={
        <>
          Typical error after {days} {days === 1 ? "day" : "days"} (root-mean-squared, drills a day): sample mean {fmt(r.mle, 2)}, defensible prior{" "}
          <span className="font-semibold tabular" data-testid="pd-world">{fmt(r.defensible, 2)}</span>, wrong prior {fmt(r.wrong, 2)}.
        </>
      }
    >
      <Slider id="pd-world-days" label="Days of data per store" value={di} min={0} max={DAYS.length - 1} step={1} onChange={setDi} display={(i) => String(DAYS[i])} />
      <svg viewBox={`0 0 ${VW} 130`} className="mt-3 h-auto w-full" role="img" aria-label="Error of three estimates">
        {bars.map((b, i) => (
          <g key={b.name}>
            <rect x={8} y={10 + i * 38} width={Math.max(2, x(Math.min(b.v, 2.7)) - 8)} height={24} fill={b.color} rx={3} />
            <text x={Math.max(2, x(Math.min(b.v, 2.7))) + 6} y={27 + i * 38} fontSize={12} fill="var(--ink)" className="tabular">
              {fmt(b.v, 2)}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {bars.map((b) => (
          <Key key={b.name} color={b.color} label={b.name} shape="bar" />
        ))}
      </div>
    </Panel>
  );
}

/** A prior built from last year's endcap test, combined with a small new test. */
export function LiftPrior() {
  const [est, setEst] = useState(12);
  const [se, setSe] = useState(4);
  const post = normalNormal(6, 4, est, se * se, 1);
  const xs = useMemo(() => grid(-10, 30, 401), []);
  const curves = [
    { name: "Prior from last year: Normal(6, 2²)", f: (v: number) => normalPdf(v, 6, 2), color: "var(--series-2)" },
    { name: `New test alone: ${fmt(est, 1)} ± ${fmt(se, 1)}`, f: (v: number) => normalPdf(v, est, se), color: "var(--series-7)" },
    { name: "Posterior", f: (v: number) => normalPdf(v, post.mean, Math.sqrt(post.variance)), color: "var(--series-1)" },
  ];
  const yMax = Math.max(...curves.map((c) => c.f(c.name === "Posterior" ? post.mean : c.name.startsWith("Prior") ? 6 : est))) * 1.1;
  const x = linear([-10, 30], [L, VW - 14]);
  const y = linear([0, yMax], [B, 12]);
  return (
    <Panel
      title="Last year's lift test becomes this year's prior"
      footer={
        <>
          Posterior lift <span className="font-semibold tabular" data-testid="pd-lift">{fmt(Math.round(post.mean * 100) / 100, 2)}%</span> ± {fmt(Math.sqrt(post.variance), 2)}. The new test
          gets weight {fmt(post.weightOnData, 2)}, the prior {fmt(1 - post.weightOnData, 2)}.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="pd-est" label="New test's lift estimate (%)" value={est} min={-5} max={25} step={0.5} onChange={setEst} />
        <Slider id="pd-se" label="New test's standard error (%)" value={se} min={1} max={10} step={0.5} onChange={setSe} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Prior, new test and posterior for the endcap lift">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="density" format={(v) => fmt(v, 2)} />
        <Axis scale={x} orient="bottom" at={B} label="endcap lift (%)" />
        {curves.map((c) => (
          <polyline key={c.name} points={xs.map((v) => `${x(v).toFixed(1)},${y(c.f(v)).toFixed(1)}`).join(" ")} fill="none" stroke={c.color} strokeWidth={c.name === "Posterior" ? 2.5 : 2} strokeDasharray={c.name === "Posterior" ? undefined : "5 4"} />
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

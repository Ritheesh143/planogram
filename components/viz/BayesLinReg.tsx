"use client";

import { useMemo, useState } from "react";
import { normalPdf } from "@/lib/sim/bayes";
import { BL_SIGMA2, slopeIntervals, slopePosterior, type CoverageMode } from "@/lib/sim/pooling";
import { mulberry32, normal } from "@/lib/sim/rng";
import { LR_PRICE, LR_UNITS } from "./LinRegPlayground";
import { Axis, Key, linear, Panel } from "./kit";

const VW = 460;
const H = 260;
const L = 48;
const B = H - 34;

/** Prior variances for the slope (litres per ₹100), from very sure it's near 0 to no prior at all. */
export const BL_TAU2 = [0.1, 0.4, 1.6, 6.4, 25.6, Infinity];
const label = (t: number) => (Number.isFinite(t) ? `τ² = ${t}` : "flat (no prior)");

// With centered prices the intercept is the sales at ₹600: 52, known to within σ²/n = 0.8.
const MEAN_Y = 52;
const INTERCEPT_VAR = BL_SIGMA2 / 5;

export function PlausibleLines() {
  const [tIdx, setTIdx] = useState(1);
  const [band, setBand] = useState(false);
  const tau2 = BL_TAU2[tIdx];
  const post = slopePosterior(LR_PRICE, LR_UNITS, BL_SIGMA2, tau2);
  const lines = useMemo(() => {
    const rng = mulberry32(8);
    return Array.from({ length: 50 }, () => ({ a: normal(rng, MEAN_Y, Math.sqrt(INTERCEPT_VAR)), b: normal(rng, post.mean, post.sd) }));
  }, [post.mean, post.sd]);
  const x = linear([2, 12], [L, VW - 14]);
  const y = linear([0, 100], [B, 12]);
  const at = (a: number, b: number, p: number) => a + b * (p - 6);
  const xs = Array.from({ length: 41 }, (_, i) => 2 + i * 0.25);
  const predSd = (p: number) => Math.sqrt(BL_SIGMA2 + INTERCEPT_VAR + (p - 6) ** 2 * post.sd ** 2);
  const bandPath = [
    ...xs.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(Math.min(100, at(MEAN_Y, post.mean, p) + 1.6449 * predSd(p))).toFixed(1)}`),
    ...[...xs].reverse().map((p) => `L${x(p).toFixed(1)},${y(Math.max(0, at(MEAN_Y, post.mean, p) - 1.6449 * predSd(p))).toFixed(1)}`),
    "Z",
  ].join("");
  // Second chart: belief about the slope itself.
  const bx = linear([-12, 2], [L, VW - 14]);
  const bs = Array.from({ length: 281 }, (_, i) => -12 + i * 0.05);
  const like = { m: -8, s: Math.sqrt(BL_SIGMA2 / 10) };
  const curves = [
    ...(Number.isFinite(tau2) ? [{ name: "Prior: slope near 0", m: 0, s: Math.sqrt(tau2), color: "var(--series-1)" }] : []),
    { name: "Likelihood: the five weeks alone", ...like, color: "var(--series-2)" },
    { name: "Posterior", m: post.mean, s: post.sd, color: "var(--series-3)" },
  ];
  const peak = Math.max(...curves.map((c) => normalPdf(c.m, c.m, c.s)));
  const by = linear([0, peak * 1.1], [B, 12]);
  const curve = (m: number, s: number) => bs.map((v, i) => `${i ? "L" : "M"}${bx(v).toFixed(1)},${by(normalPdf(v, m, s)).toFixed(1)}`).join("");

  return (
    <Panel
      title="Not one line but fifty: each is a slope you still believe is plausible"
      footer={
        <>
          Prior {label(tau2)} gives λ = σ²/τ² = <span className="font-semibold tabular" data-testid="bl-lambda">{Number.isFinite(tau2) ? Number(post.lambda.toFixed(3)) : 0}</span>. Posterior slope{" "}
          <span className="font-semibold tabular" data-testid="bl-mean">{post.mean.toFixed(2)}</span> litres per ₹100, sd{" "}
          <span className="font-semibold tabular" data-testid="bl-sd">{post.sd.toFixed(2)}</span>. Least squares alone says −8.
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Prior on the slope">
        {BL_TAU2.map((t, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={tIdx === i}
            onClick={() => setTIdx(i)}
            className={tIdx === i ? "rounded-md bg-accent px-2 py-0.5 text-xs text-white" : "rounded-md border border-line px-2 py-0.5 text-xs"}
          >
            {label(t)}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={band} onChange={(e) => setBand(e.target.checked)} /> 90% band for a new week
        </label>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Fifty plausible demand lines over price">
          <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="litres / week" />
          <Axis scale={x} orient="bottom" at={B} format={(v) => `₹${v * 100}`} label="price per litre" />
          {band && <path d={bandPath} fill="var(--series-3)" fillOpacity={0.15} />}
          {lines.map((l, i) => (
            <line key={i} x1={x(2)} x2={x(12)} y1={y(at(l.a, l.b, 2))} y2={y(at(l.a, l.b, 12))} stroke="var(--series-3)" strokeOpacity={0.25} />
          ))}
          <line x1={x(2)} x2={x(12)} y1={y(at(MEAN_Y, -8, 2))} y2={y(at(MEAN_Y, -8, 12))} stroke="var(--series-2)" strokeDasharray="6 4" strokeWidth={1.5} />
          {LR_PRICE.map((p, i) => (
            <circle key={i} cx={x(p)} cy={y(LR_UNITS[i])} r={4.5} fill="var(--ink)" stroke="var(--surface-1)" strokeWidth={1.5} />
          ))}
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Prior, likelihood and posterior for the slope">
          <Axis scale={bx} orient="bottom" at={B} label="slope (litres per ₹100)" />
          {curves.map((c) => (
            <path key={c.name} d={curve(c.m, c.s)} fill="none" stroke={c.color} strokeWidth={c.color === "var(--series-3)" ? 3 : 2} />
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="The five paint weeks" />
        <Key color="var(--series-3)" label="Posterior: 50 plausible lines, and belief about the slope" shape="line" />
        <Key color="var(--series-2)" label="Least squares / the data alone" shape="line" />
        {Number.isFinite(tau2) && <Key color="var(--series-1)" label="Prior" shape="line" />}
      </div>
    </Panel>
  );
}

const MODES: { id: CoverageMode; name: string }[] = [
  { id: "matched", name: "Prior matches the world" },
  { id: "wrong", name: "Confident prior, wrong world" },
  { id: "flat", name: "Flat prior" },
];

/** Re-run the five-week world 2,000 times and count how often the 90% credible interval catches the truth. */
export function SlopeCoverage() {
  const [mode, setMode] = useState<CoverageMode>("matched");
  const ivs = useMemo(() => slopeIntervals(mode, 2000, 5), [mode]);
  const cov = ivs.filter((i) => i.covers).length / ivs.length;
  const shown = ivs.slice(0, 40);
  const lo = Math.min(...shown.map((i) => Math.min(i.lo, i.truth))) - 0.5;
  const hi = Math.max(...shown.map((i) => Math.max(i.hi, i.truth))) + 0.5;
  const x = linear([0, 41], [L, VW - 14]);
  const y = linear([lo, hi], [B, 12]);
  return (
    <Panel
      title="2,000 repeats of the five-week world: how often does the 90% interval contain the true slope?"
      footer={
        <>
          Coverage: <span className="font-semibold tabular" data-testid="bl-coverage">{(cov * 100).toFixed(1)}%</span> of 2,000 intervals contain the true slope. The first 40 are drawn.
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="World and prior">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => setMode(m.id)}
            className={mode === m.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {m.name}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`Forty credible intervals; coverage ${(cov * 100).toFixed(1)}%`}>
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="slope" />
        {shown.map((iv, k) => (
          <g key={k}>
            <line x1={x(k + 1)} x2={x(k + 1)} y1={y(iv.lo)} y2={y(iv.hi)} stroke={iv.covers ? "var(--series-1)" : "var(--critical)"} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={x(k + 1)} cy={y(iv.truth)} r={2.5} fill="var(--ink)" />
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Interval contains the truth" shape="line" />
        <Key color="var(--critical)" label="Interval misses" shape="line" />
        <Key color="var(--ink)" label="True slope in that world" />
      </div>
    </Panel>
  );
}

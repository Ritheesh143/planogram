"use client";

import { useMemo, useState } from "react";
import { betaInterval, betaPdf, binomialPmf, gridPosterior } from "@/lib/sim/bayes";
import { BB_VISITORS, simulateEndcaps } from "@/lib/sim/bayesSim";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 260;
const L = 44;
const B = H - 34;

// Prior strength a + b, with the prior mean held at 20% (past endcaps).
export const BB_STRENGTHS = [2, 5, 10, 20, 50, 100];
const PRIOR_MEAN = 0.2;

/** Update a conversion rate one shopper at a time. */
export function BetaUpdater() {
  const [shoppers, setShoppers] = useState<number[]>(BB_VISITORS);
  const [sIdx, setSIdx] = useState(2);
  const strength = BB_STRENGTHS[sIdx];
  const a = PRIOR_MEAN * strength;
  const b = (1 - PRIOR_MEAN) * strength;
  const n = shoppers.length;
  const k = shoppers.reduce((s, v) => s + v, 0);
  const pa = a + k;
  const pb = b + n - k;
  const mean = pa / (pa + pb);
  const [lo, hi] = betaInterval(pa, pb, 0.9);

  // The same posterior computed the slow way: 50 thin bars of prior × likelihood, normalized.
  const bars = useMemo(() => {
    const ps = Array.from({ length: 50 }, (_, i) => 0.01 + i * 0.02);
    const post = gridPosterior(
      ps.map((p) => betaPdf(p, a, b)),
      ps.map((p) => binomialPmf(k, n, p)),
    );
    return ps.map((p, i) => ({ p, density: post[i] / 0.02 }));
  }, [a, b, k, n]);

  const xs = Array.from({ length: 199 }, (_, i) => (i + 1) / 200);
  const postCurve = xs.map((p) => betaPdf(p, pa, pb));
  const priorCurve = xs.map((p) => betaPdf(p, a, b));
  const top = Math.min(30, Math.max(...postCurve, ...priorCurve.filter(Number.isFinite), ...bars.map((d) => d.density)) * 1.08);
  const x = linear([0, 1], [L, VW - 12]);
  const y = linear([0, top], [B, 12]);
  const path = (vals: number[]) => xs.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(Math.min(top, vals[i])).toFixed(1)}`).join("");

  const btn = "rounded-lg border border-line px-3 py-1 text-sm hover:border-accent";
  return (
    <Panel
      title="An endcap's conversion rate, updated shopper by shopper"
      footer={
        <>
          Prior Beta({fmt(a, 1)}, {fmt(b, 1)}) + {k} of {n} bought → posterior{" "}
          <span className="font-semibold tabular" data-testid="bb-post">
            Beta({fmt(pa, 1)}, {fmt(pb, 1)})
          </span>
          . Mean{" "}
          <span className="font-semibold tabular" data-testid="bb-mean">
            {fmt(mean, 3)}
          </span>
          , 90% interval{" "}
          <span className="font-semibold tabular" data-testid="bb-interval">
            {fmt(lo, 3)} to {fmt(hi, 3)}
          </span>
          . {n > 0 ? `The raw rate is ${k}/${n} = ${fmt(k / n, 3)}. ` : ""}Chance the next shopper buys: {fmt(mean, 3)}.
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShoppers((s) => [...s, 1])} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white">
          Next shopper buys
        </button>
        <button type="button" onClick={() => setShoppers((s) => [...s, 0])} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white">
          Next shopper doesn&apos;t
        </button>
        <button type="button" onClick={() => setShoppers((s) => s.slice(0, -1))} disabled={n === 0} className={`${btn} disabled:opacity-50`}>
          Undo
        </button>
        <button type="button" onClick={() => setShoppers([])} className={btn}>
          No shoppers yet
        </button>
        <button type="button" onClick={() => setShoppers(BB_VISITORS)} className={btn}>
          Back to the 10 shoppers
        </button>
      </div>
      <div className="mt-3">
        <Slider
          id="bb-strength"
          label="Prior strength a + b (pseudo-shoppers from past endcaps, mean held at 20%)"
          value={sIdx}
          min={0}
          max={BB_STRENGTHS.length - 1}
          step={1}
          onChange={setSIdx}
          display={(i) => String(BB_STRENGTHS[i])}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-xs" aria-label="Shoppers so far">
        {shoppers.map((v, i) => (
          <span key={i} className={`rounded px-1.5 py-0.5 ${v ? "bg-accent text-white" : "bg-surface-2 text-ink-2"}`}>
            {v ? "bought" : "no"}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`Posterior Beta(${fmt(pa, 1)}, ${fmt(pb, 1)}) for the conversion rate`}>
        <Axis scale={y} orient="left" at={L} gridTo={VW - 12} label="density" format={(v) => fmt(v, 0)} />
        <Axis scale={x} orient="bottom" at={B} format={(v) => `${Math.round(v * 100)}%`} label="conversion rate p" />
        <rect x={x(lo)} y={12} width={x(hi) - x(lo)} height={B - 12} fill="var(--accent-wash)" />
        {bars.map((d) => (
          <rect key={d.p} x={x(d.p - 0.01) + 0.5} y={y(Math.min(top, d.density))} width={x(0.02) - x(0) - 1} height={B - y(Math.min(top, d.density))} fill="var(--seq-250)" />
        ))}
        <path d={path(priorCurve)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeDasharray="5 4" />
        <path d={path(postCurve)} fill="none" stroke="var(--series-3)" strokeWidth={2.5} />
        <line x1={x(mean)} x2={x(mean)} y1={12} y2={B} stroke="var(--ink)" strokeDasharray="3 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Prior" shape="line" />
        <Key color="var(--series-3)" label="Posterior (the Beta formula)" shape="line" />
        <Key color="var(--seq-250)" label="Posterior from 50 thin bars of prior × likelihood" shape="bar" />
        <Key color="var(--accent-wash)" label="90% credible interval" shape="bar" />
      </div>
    </Panel>
  );
}

/** 1,000 endcaps: does the posterior mean beat the raw rate, and do 90% intervals cover 90%? */
export function EndcapSimulation() {
  const [visitors, setVisitors] = useState(10);
  const [seed, setSeed] = useState(9);
  const r = useMemo(() => simulateEndcaps(1000, 2, 8, visitors, seed), [visitors, seed]);
  const x = linear([0, 0.8], [L, VW - 12]);
  const y = linear([0, 0.8], [B, 12]);
  return (
    <Panel
      title="1,000 endcaps, true rates drawn from past endcaps (Beta(2, 8)), each watched for a few shoppers"
      footer={
        <>
          Average miss of the raw rate:{" "}
          <span className="font-semibold tabular" data-testid="bb-sim-raw">
            {fmt(r.rawError * 100, 1)}
          </span>{" "}
          points. Of the posterior mean:{" "}
          <span className="font-semibold tabular" data-testid="bb-sim-post">
            {fmt(r.postError * 100, 1)}
          </span>{" "}
          points. 90% intervals caught the true rate{" "}
          <span className="font-semibold tabular" data-testid="bb-sim-cover">
            {fmt(r.coverage * 100, 1)}%
          </span>{" "}
          of the time.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {[10, 50].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={visitors === v}
            onClick={() => setVisitors(v)}
            className={visitors === v ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {v} shoppers per endcap
          </button>
        ))}
        <button type="button" onClick={() => setSeed((s) => s + 1)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
          Run 1,000 new endcaps
        </button>
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Estimated against true conversion rates for 200 endcaps">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 12} format={(v) => `${Math.round(v * 100)}%`} label="estimate" />
        <Axis scale={x} orient="bottom" at={B} format={(v) => `${Math.round(v * 100)}%`} label="true rate" />
        <line x1={x(0)} y1={y(0)} x2={x(0.8)} y2={y(0.8)} stroke="var(--axis)" />
        {r.sample.map((d, i) => (
          <circle key={`r${i}`} cx={x(Math.min(0.8, d.truth))} cy={y(Math.min(0.8, d.raw))} r={2.5} fill="var(--series-2)" fillOpacity={0.6} />
        ))}
        {r.sample.map((d, i) => (
          <circle key={`p${i}`} cx={x(Math.min(0.8, d.truth))} cy={y(Math.min(0.8, d.post))} r={2.5} fill="var(--series-3)" fillOpacity={0.8} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-2)" label="Raw rate k / n" />
        <Key color="var(--series-3)" label="Posterior mean (a + k) / (a + b + n)" />
        <Key color="var(--axis)" label="Perfect estimate" shape="line" />
      </div>
    </Panel>
  );
}

"use client";

import { useMemo, useState } from "react";
import { gammaInterval, gammaPdf, gammaPoissonUpdate, grid, negBinomialPmf } from "@/lib/sim/bayes";
import { poissonPmf } from "@/lib/sim/prob";
import { poolStores } from "@/lib/sim/priors";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

// Keystone 3's three days of cordless-drill sales at one store.
export const GP_DAYS = [0, 2, 1];
export const GP_PRIOR = { shape: 2, rate: 1 };

const VW = 460;
const H = 240;
const L = 52;
const B = H - 34;

/** The smallest k with P(X ≤ k) ≥ p, for a pmf over 0, 1, 2, … */
export function pmfQuantile(pmf: (k: number) => number, p: number): number {
  let c = 0;
  for (let k = 0; k < 1000; k++) {
    c += pmf(k);
    if (c >= p) return k;
  }
  return 1000;
}

export function GammaPoissonUpdater() {
  const [shape, setShape] = useState(GP_PRIOR.shape);
  const [rate, setRate] = useState(GP_PRIOR.rate);
  const [days, setDays] = useState<number[]>(GP_DAYS);
  const sum = days.reduce((a, b) => a + b, 0);
  const [a, b] = gammaPoissonUpdate(shape, rate, sum, days.length);
  const mean = a / b;
  const [lo, hi] = gammaInterval(a, b, 0.9);
  const lams = useMemo(() => grid(0.01, 6, 300), []);
  const prior = lams.map((l) => gammaPdf(l, shape, rate));
  const post = lams.map((l) => gammaPdf(l, a, b));
  const yMax = Math.max(...post, ...prior.map((v) => Math.min(v, 3))) * 1.08;
  const x = linear([0, 6], [L, VW - 14]);
  const y = linear([0, yMax], [B, 12]);
  const path = (vals: number[]) => lams.map((l, i) => `${i ? "L" : "M"}${x(l).toFixed(1)},${y(Math.min(vals[i], yMax)).toFixed(1)}`).join("");

  const ks = Array.from({ length: 9 }, (_, k) => k);
  const nb = (k: number) => negBinomialPmf(k, a, b);
  const po = (k: number) => poissonPmf(k, mean);
  const tail = (f: (k: number) => number) => 1 - f(0) - f(1) - f(2);
  const px = linear([-0.5, 8.5], [L, VW - 14]);
  const py = linear([0, Math.max(...ks.map((k) => Math.max(nb(k), po(k)))) * 1.1], [B, 12]);
  const bw = (px(1) - px(0)) * 0.36;

  return (
    <Panel
      title="Update a gamma prior on the store's daily drill rate, one day at a time"
      footer={
        <>
          Prior Gamma({fmt(shape, 1)}, {fmt(rate, 1)}): mean {fmt(shape / rate, 2)}. After {days.length} {days.length === 1 ? "day" : "days"} selling {sum}{" "}
          {sum === 1 ? "drill" : "drills"}: posterior <span className="font-semibold tabular" data-testid="gp-post">Gamma({fmt(a, 1)}, {fmt(b, 1)})</span>, mean{" "}
          <span className="font-semibold tabular" data-testid="gp-mean">{fmt(mean, 2)}</span> drills a day, 90% credible interval{" "}
          <span className="font-semibold tabular" data-testid="gp-interval">
            {fmt(lo, 2)} to {fmt(hi, 2)}
          </span>
          .
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="gp-shape" label="Prior shape α (pseudo-sales)" value={shape} min={0.5} max={10} step={0.5} onChange={setShape} />
        <Slider id="gp-rate" label="Prior rate β (pseudo-days)" value={rate} min={0.5} max={10} step={0.5} onChange={setRate} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-ink-2">Days so far:</span>
        {days.map((d, i) => (
          <span key={i} className="rounded-md bg-surface-2 px-2 py-0.5 text-sm tabular">
            {d}
          </span>
        ))}
        <span className="ml-2 text-sm text-ink-2">Add a day selling</span>
        {[0, 1, 2, 3, 4].map((k) => (
          <button key={k} type="button" onClick={() => setDays((ds) => [...ds, k])} className="rounded-md border border-line px-2 py-0.5 text-sm hover:border-accent" aria-label={`Add a day selling ${k}`}>
            {k}
          </button>
        ))}
        <button type="button" onClick={() => setDays((ds) => ds.slice(0, -1))} disabled={days.length === 0} className="rounded-md border border-line px-2 py-0.5 text-sm disabled:opacity-40">
          Remove last
        </button>
        <button
          type="button"
          onClick={() => {
            setDays(GP_DAYS);
            setShape(GP_PRIOR.shape);
            setRate(GP_PRIOR.rate);
          }}
          className="rounded-md border border-line px-2 py-0.5 text-sm"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-sm font-medium">What we believe about the rate λ</div>
          <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label={`Prior and posterior over the daily rate; posterior mean ${fmt(mean, 2)}`}>
            <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="belief (density)" format={(v) => fmt(v, 1)} />
            <Axis scale={x} orient="bottom" at={B} label="daily rate λ (drills)" />
            <rect x={x(lo)} y={12} width={x(hi) - x(lo)} height={B - 12} fill="var(--series-1)" fillOpacity={0.08} />
            <path d={path(prior)} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 4" />
            <path d={path(post)} fill="none" stroke="var(--series-1)" strokeWidth={2.5} />
            {days.length > 0 && <line x1={x(sum / days.length)} x2={x(sum / days.length)} y1={12} y2={B} stroke="var(--ink-2)" strokeDasharray="2 3" />}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Key color="var(--series-2)" label="Prior" shape="line" />
            <Key color="var(--series-1)" label="Posterior (shaded: 90% interval)" shape="line" />
            <Key color="var(--ink-2)" label="Sample mean (the MLE)" shape="line" />
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Tomorrow&apos;s sales: predictive vs a plain Poisson</div>
          <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Predictive probabilities for tomorrow's sales">
            <Axis scale={py} orient="left" at={L} gridTo={VW - 14} label="probability" format={(v) => fmt(v, 2)} />
            <Axis scale={px} orient="bottom" at={B} tickValues={ks} label="drills sold tomorrow" />
            {ks.map((k) => (
              <g key={k}>
                <rect x={px(k) - bw} y={py(nb(k))} width={bw} height={B - py(nb(k))} fill="var(--series-1)" rx={1.5} />
                <rect x={px(k)} y={py(po(k))} width={bw} height={B - py(po(k))} fill="var(--series-2)" rx={1.5} />
              </g>
            ))}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Key color="var(--series-1)" label="Predictive (negative binomial)" shape="bar" />
            <Key color="var(--series-2)" label={`Poisson at the posterior mean ${fmt(mean, 2)}`} shape="bar" />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            P(0) = <span className="font-semibold tabular" data-testid="gp-p0">{fmt(nb(0), 3)}</span> vs {fmt(po(0), 3)}; P(3 or more) ={" "}
            <span className="font-semibold tabular" data-testid="gp-pge3">{fmt(tail(nb), 3)}</span> vs {fmt(tail(po), 3)}. Stock for a 95% chance of not running out:{" "}
            <span className="font-semibold tabular" data-testid="gp-p95">{pmfQuantile(nb, 0.95)}</span> drills vs {pmfQuantile(po, 0.95)}.
          </p>
        </div>
      </div>
    </Panel>
  );
}

const KS = [0.5, 1, 2, 4, 8, Infinity];

/** 40 stores, 90 days each: pooled daily sales are more spread out than any one Poisson. */
export function PoolSimulation() {
  const [ki, setKi] = useState(2);
  const k = KS[ki];
  const r = useMemo(() => poolStores(k), [k]);
  const total = r.counts.reduce((a, b) => a + b, 0);
  const poisExp = r.counts.map((_, i) => total * (i === 12 ? 1 - Array.from({ length: 12 }, (_, j) => poissonPmf(j, r.mean)).reduce((s, v) => s + v, 0) : poissonPmf(i, r.mean)));
  const x = linear([-0.5, 12.5], [L, VW - 14]);
  const y = linear([0, Math.max(...r.counts, ...poisExp) * 1.1], [B, 12]);
  const w = (x(1) - x(0)) * 0.7;
  return (
    <Panel
      title="40 stores × 90 days of drill sales, pooled. Each store is Poisson; the chain isn't."
      footer={
        <>
          Pooled mean {fmt(r.mean, 2)}, variance {fmt(r.variance, 2)}: variance ÷ mean ={" "}
          <span className="font-semibold tabular" data-testid="gp-ratio">{fmt(r.ratio, 2)}</span>. A single Poisson would give 1.
          {Number.isFinite(k) && ` The gamma-Poisson formula predicts 1 + mean/k ≈ ${fmt(1 + 2 / k, 2)}.`}
        </>
      }
    >
      <Slider
        id="gp-k"
        label="How alike the stores are (gamma shape k of their rates)"
        value={ki}
        min={0}
        max={KS.length - 1}
        step={1}
        onChange={setKi}
        display={(i) => (Number.isFinite(KS[i]) ? `k = ${KS[i]}` : "identical stores")}
      />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of pooled daily sales with a Poisson overlay">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="store-days" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[0, 2, 4, 6, 8, 10, 12]} format={(v) => (v === 12 ? "12+" : String(v))} label="drills sold in a day" />
        {r.counts.map((c, i) => (
          <rect key={i} x={x(i) - w / 2} y={y(c)} width={w} height={B - y(c)} fill="var(--seq-250)" rx={1.5} />
        ))}
        <polyline points={poisExp.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--series-2)" strokeWidth={2} />
        {poisExp.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--series-2)" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-250)" label="Simulated store-days" shape="bar" />
        <Key color="var(--series-2)" label="What one Poisson with the same mean expects" shape="line" />
      </div>
    </Panel>
  );
}

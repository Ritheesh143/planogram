"use client";

import { useMemo, useState } from "react";
import { chainWorld, mse, pool, poolingStudy, tauLogLik } from "@/lib/sim/pooling";
import { mulberry32 } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel } from "./kit";

const VW = 460;
const H = 270;
const L = 48;
const B = H - 34;

// The same 40 stores as the shrinkage lesson: true means ~ N(50, 10²), weekly noise sd 20.
export const HP_SEED = 1;
export const HP_SIGMA2 = 400;

type Mode = "none" | "complete" | "partial";
const MODES: { id: Mode; name: string }[] = [
  { id: "none", name: "No pooling" },
  { id: "complete", name: "Complete pooling" },
  { id: "partial", name: "Partial pooling" },
];

export function PoolingPlot() {
  const chain = useMemo(() => chainWorld(mulberry32(HP_SEED)), []);
  const p = useMemo(() => pool(chain, HP_SIGMA2), [chain]);
  const [mode, setMode] = useState<Mode>("partial");
  const est = p[mode];
  // x: weeks of history on a log scale, nudged so stores with the same history don't overlap.
  const x = linear([Math.log(0.8), Math.log(65)], [L, VW - 14]);
  const px = (j: number) => x(Math.log(chain.n[j])) + (j % 2 ? 4 : -4);
  const y = linear([0, 100], [B, 12]);
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return (
    <Panel
      title="40 stores, sorted by how many weeks of history they have"
      footer={
        <>
          Mean squared error against the planted truth: no pooling{" "}
          <span className="font-semibold tabular" data-testid="hp-mse-none">{fmt(mse(p.none, chain.theta), 1)}</span>, complete pooling{" "}
          <span className="font-semibold tabular" data-testid="hp-mse-complete">{fmt(mse(p.complete, chain.theta), 1)}</span>, partial pooling{" "}
          <span className="font-semibold tabular" data-testid="hp-mse-partial">{fmt(mse(p.partial, chain.theta), 1)}</span>. Estimated from the stores themselves: chain mean{" "}
          {fmt(p.mu, 1)}, store spread τ̂ = <span className="font-semibold tabular" data-testid="hp-tau">{fmt(Math.sqrt(p.tau2), 1)}</span> (the truth is 50 and 10).
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pooling">
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
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`${mode} pooling estimates for 40 stores`}>
        <defs>
          <marker id="hp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0L10,5L0,10z" fill="var(--series-3)" />
          </marker>
        </defs>
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="litres / week" />
        <Axis
          scale={x}
          orient="bottom"
          at={B}
          tickValues={[1, 2, 4, 8, 16, 52].map(Math.log)}
          format={(v) => String(Math.round(Math.exp(v)))}
          label="weeks of history (log scale)"
        />
        <line x1={L} x2={VW - 14} y1={y(p.mu)} y2={y(p.mu)} stroke="var(--series-1)" strokeDasharray="4 3" />
        {chain.theta.map((t, j) => (
          <line key={`t${j}`} x1={px(j) - 4} x2={px(j) + 4} y1={y(clamp(t))} y2={y(clamp(t))} stroke="var(--ink)" strokeWidth={2} />
        ))}
        {mode === "partial"
          ? chain.ybar.map((v, j) => (
              <g key={`p${j}`}>
                <circle cx={px(j)} cy={y(clamp(v))} r={3} fill="none" stroke="var(--series-2)" strokeWidth={1.2} />
                {Math.abs(est[j] - v) > 1.5 && (
                  <line x1={px(j)} x2={px(j)} y1={y(clamp(v))} y2={y(clamp(est[j]))} stroke="var(--series-3)" strokeWidth={1.2} markerEnd="url(#hp-arrow)" />
                )}
                <circle cx={px(j)} cy={y(clamp(est[j]))} r={3.5} fill="var(--series-3)" />
              </g>
            ))
          : est.map((v, j) => <circle key={`e${j}`} cx={px(j)} cy={y(clamp(v))} r={3.5} fill={mode === "none" ? "var(--series-2)" : "var(--series-1)"} />)}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="True store mean (planted)" shape="line" />
        <Key color="var(--series-2)" label="Store's own average" />
        <Key color="var(--series-1)" label="Chain average" />
        <Key color="var(--series-3)" label="Partial pooling" />
      </div>
    </Panel>
  );
}

/** The store spread τ is itself unknown: a grid of hypotheses for τ, scored by how well each explains the stores. */
export function TauGrid() {
  const chain = useMemo(() => chainWorld(mulberry32(HP_SEED)), []);
  const taus = useMemo(() => Array.from({ length: 301 }, (_, i) => i * 0.1), []);
  const post = useMemo(() => {
    const ll = taus.map((t) => tauLogLik(chain, HP_SIGMA2, t));
    const m = Math.max(...ll);
    const w = ll.map((v) => Math.exp(v - m));
    const tot = w.reduce((a, b) => a + b, 0);
    return w.map((v) => v / tot);
  }, [chain, taus]);
  let cum = 0;
  let lo = 0;
  let hi = 0;
  taus.forEach((t, i) => {
    const prev = cum;
    cum += post[i];
    if (prev < 0.05 && cum >= 0.05) lo = t;
    if (prev < 0.95 && cum >= 0.95) hi = t;
  });
  const peak = taus[post.indexOf(Math.max(...post))];
  const x = linear([0, 30], [L, VW - 14]);
  const y = linear([0, Math.max(...post) * 1.1], [B, 12]);
  return (
    <Panel
      title="How spread out are the stores? A posterior over τ itself"
      footer={
        <>
          With a flat prior on τ from 0 to 30, the posterior peaks at <span className="font-semibold tabular" data-testid="hp-tau-peak">{fmt(peak, 1)}</span>, with a 90% credible
          interval from {fmt(lo, 1)} to {fmt(hi, 1)}. Full Bayes averages the store estimates over this whole curve instead of plugging in one τ.
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Posterior bars over the store spread tau">
        <Axis scale={x} orient="bottom" at={B} label="τ: sd of true store means (litres / week)" />
        {taus.map((t, i) =>
          i % 5 === 0 ? (
            <rect key={i} x={x(t) - 2} y={y(post[i])} width={4} height={B - y(post[i])} fill={t >= lo && t <= hi ? "var(--series-3)" : "var(--seq-250)"} />
          ) : null,
        )}
        <line x1={x(10)} x2={x(10)} y1={12} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
        <text x={x(10) + 4} y={24} fontSize={11} fill="var(--ink-2)">
          planted τ = 10
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-3)" label="Inside the 90% credible interval" shape="bar" />
        <Key color="var(--seq-250)" label="Outside it" shape="bar" />
      </div>
    </Panel>
  );
}

const TAUS = [2, 5, 10, 20, 40];

/** Average error of each pooling choice over 300 simulated chains, for different true store spreads. */
export function PoolingStudy() {
  const results = useMemo(() => TAUS.map((t) => ({ t, ...poolingStudy(t, 300, 7) })), []);
  const x = linear([0, TAUS.length], [L, VW - 14]);
  const top = 120;
  const y = linear([0, top], [B, 12]);
  const bars: { k: "none" | "complete" | "partial"; color: string; name: string }[] = [
    { k: "none", color: "var(--series-2)", name: "No pooling" },
    { k: "complete", color: "var(--series-1)", name: "Complete pooling" },
    { k: "partial", color: "var(--series-3)", name: "Partial pooling" },
  ];
  return (
    <Panel
      title="300 chains for each true store spread τ: average squared error of each choice"
      footer={
        <>
          At τ = 10: no pooling <span className="tabular">{fmt(results[2].none, 1)}</span>, complete pooling <span className="tabular">{fmt(results[2].complete, 1)}</span>, partial
          pooling <span className="font-semibold tabular" data-testid="hp-study-partial">{fmt(results[2].partial, 1)}</span>. Bars above {top} are cut off and labelled.
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Grouped bars of average error by true store spread">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="mean squared error" />
        {results.map((r, i) =>
          bars.map((b, k) => {
            const v = r[b.k];
            const bx = x(i) + 10 + k * 22;
            return (
              <g key={`${i}${b.k}`}>
                <rect x={bx} y={y(Math.min(top, v))} width={18} height={B - y(Math.min(top, v))} fill={b.color} />
                {v > top && (
                  <text x={bx + 9} y={y(top) + 12} fontSize={9} textAnchor="middle" fill="var(--surface-1)">
                    {Math.round(v)}
                  </text>
                )}
              </g>
            );
          }),
        )}
        {results.map((r, i) => (
          <text key={r.t} x={x(i) + 43} y={B + 16} fontSize={11} textAnchor="middle" fill="var(--muted)">
            τ = {r.t}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {bars.map((b) => (
          <Key key={b.k} color={b.color} label={b.name} shape="bar" />
        ))}
      </div>
    </Panel>
  );
}

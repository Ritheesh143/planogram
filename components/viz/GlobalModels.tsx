"use client";

import { useMemo, useState } from "react";
import {
  boostCurve,
  compoundDraw,
  fitBooster,
  mean,
  MINT_SD,
  mintStudy,
  panel,
  PANEL,
  reconcile3,
  tweedieParams,
  type ReconMethod,
} from "@/lib/sim/demand";
import { mulberry32 } from "@/lib/sim/rng";
import { Axis, Key, linear, Panel, Slider, ticks } from "./kit";

const VW = 460;
const H = 230;
const L = 44;
const B = H - 32;
const R = VW - 12;

function Radios<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={value === o.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

// ---------- fc-tweedie-lgbm ----------

export const TW_MUS = [0.3, 0.5, 1, 2, 5, 10];
export const TW_DRAWS = 4000;
export const TW_SEED = 2;

/** Draws from Tweedie(μ, φ = 1, p) via compound Poisson–gamma. */
export function tweedieDraws(mu: number, p: number, n = TW_DRAWS, seed = TW_SEED): number[] {
  const rng = mulberry32(seed);
  const t = tweedieParams(mu, 1, p);
  return Array.from({ length: n }, () => compoundDraw(rng, t.lambda, t.shape, t.scale));
}

export function TweedieShape() {
  const [mi, setMi] = useState(3);
  const [p, setP] = useState(1.5);
  const mu = TW_MUS[mi];
  const draws = useMemo(() => tweedieDraws(mu, p), [mu, p]);
  const t = tweedieParams(mu, 1, p);
  const zeros = draws.filter((v) => v === 0).length / draws.length;
  const m = mean(draws);
  const v = draws.reduce((s, x) => s + (x - m) ** 2, 0) / (draws.length - 1);
  const hi = Math.max(3 * mu + 3 * Math.sqrt(mu ** p), 1);
  const bins = 30;
  const bw = hi / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const d of draws) if (d > 0) counts[Math.min(bins - 1, Math.floor(d / bw))]++;
  const x = linear([-bw * 1.5, hi], [L, R]);
  const share = (c: number) => c / draws.length;
  const ymax = Math.max(zeros, ...counts.map(share)) * 1.1;
  const yy = linear([0, ymax], [B, 10]);
  return (
    <Panel
      title="A day's sales of one SKU under Tweedie: a spike at zero, then a continuous spread"
      footer={
        <>
          Shopper baskets per day λ = {t.lambda.toFixed(2)}, so P(zero sales) = e<sup>−λ</sup> ={" "}
          <span className="font-semibold tabular" data-testid="tw-p0">{Math.exp(-t.lambda).toFixed(3)}</span> (in {TW_DRAWS.toLocaleString("en-IN")} draws:{" "}
          <span className="font-semibold tabular" data-testid="tw-zeros">{zeros.toFixed(3)}</span>). Mean <span className="font-semibold tabular" data-testid="tw-mean">{m.toFixed(2)}</span>{" "}
          (μ = {mu}); variance <span className="font-semibold tabular" data-testid="tw-var">{v.toFixed(2)}</span> against μ<sup>p</sup> = {(mu ** p).toFixed(2)}.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider id="tw-mu" label="Mean daily sales μ" value={mi} min={0} max={TW_MUS.length - 1} step={1} onChange={setMi} display={(i) => String(TW_MUS[i])} />
        <Slider id="tw-p" label="Variance power p" value={p} min={1.1} max={1.9} step={0.1} onChange={(v) => setP(Number(v.toFixed(1)))} display={(v) => v.toFixed(1)} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of daily sales with a spike at zero">
        <Axis scale={yy} orient="left" at={L} gridTo={R} format={(v) => `${Math.round(v * 100)}%`} label="share of days" />
        <Axis scale={x} orient="bottom" at={B} tickValues={ticks(0, hi)} label="units sold" />
        <rect x={x(-bw * 1.2)} width={x(0) - x(-bw * 1.2)} y={yy(zeros)} height={B - yy(zeros)} fill="var(--series-2)" />
        {counts.map((c, i) => (
          <rect key={i} x={x(i * bw) + 0.5} width={Math.max(x(bw) - x(0) - 1, 0)} y={yy(share(c))} height={B - yy(share(c))} fill="var(--series-1)" />
        ))}
        <line x1={x(mu)} x2={x(mu)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-2)" label="Days with no sale" shape="bar" />
        <Key color="var(--series-1)" label="Days with a sale" shape="bar" />
        <Key color="var(--ink)" label="Mean μ" shape="line" />
      </div>
    </Panel>
  );
}

export const GB_SEED = 1;
export const GB_ROUNDS = 200;
export const GB_LR = 0.1;
export const GB_POWER = 1.3;
const LOSSES = [
  { id: "squared", name: "Squared error", color: "var(--series-2)" },
  { id: "poisson", name: "Poisson", color: "var(--series-1)" },
  { id: "tweedie", name: `Tweedie, p = ${GB_POWER}`, color: "var(--series-3)" },
] as const;

export function boostRuns(depth: number) {
  const rows = panel(GB_SEED);
  const train = rows.filter((r) => r.day < PANEL.trainDays);
  const test = rows.filter((r) => r.day >= PANEL.trainDays);
  return LOSSES.map((l) => ({ ...l, curve: boostCurve(fitBooster(train, l.id, GB_ROUNDS, GB_LR, GB_POWER, depth), test, 10) }));
}

export function GlobalBoost() {
  const [depth, setDepth] = useState(1);
  const runs = useMemo(() => boostRuns(depth), [depth]);
  const x = linear([10, GB_ROUNDS], [L, R]);
  const y = linear([0, 1.5], [B, 10]);
  const end = (i: number) => runs[i].curve[runs[i].curve.length - 1];
  return (
    <Panel
      title={`One model for all ${PANEL.stores} stores × ${PANEL.skus} SKUs: how close does it get to the true demand on two held-out weeks?`}
      footer={
        <>
          After {GB_ROUNDS} trees, average distance from the true daily demand: squared error{" "}
          <span className="font-semibold tabular" data-testid="gb-sq">{(end(0).truth * 100).toFixed(1)}%</span>, Poisson{" "}
          <span className="font-semibold tabular" data-testid="gb-po">{(end(1).truth * 100).toFixed(1)}%</span>, Tweedie{" "}
          <span className="font-semibold tabular" data-testid="gb-tw">{(end(2).truth * 100).toFixed(1)}%</span>. Squared error predicts negative sales for{" "}
          <span className="font-semibold tabular" data-testid="gb-neg">{end(0).negatives}</span> of {((PANEL.days - PANEL.trainDays) * PANEL.stores * PANEL.skus).toLocaleString("en-IN")} test rows. WAPE
          against what actually sold: <span className="font-semibold tabular" data-testid="gb-wape-sq">{(end(0).wape * 100).toFixed(1)}%</span> against{" "}
          <span className="font-semibold tabular" data-testid="gb-wape-tw">{(end(2).wape * 100).toFixed(1)}%</span>.
        </>
      }
    >
      <Radios
        label="Tree size"
        value={depth}
        onChange={setDepth}
        options={[
          { id: 1, name: "Stumps (one split each)" },
          { id: 4, name: "Depth 4" },
        ]}
      />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Error against the true demand as trees are added">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 0.5, 1, 1.5]} format={(v) => `${Math.round(v * 100)}%`} label="error vs true demand" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[10, 50, 100, 150, 200]} label="trees" />
        {runs.map((r) => (
          <path key={r.id} d={path(r.curve.map((c) => [x(c.rounds), y(Math.min(c.truth, 1.5))]))} fill="none" stroke={r.color} strokeWidth={2.2} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {LOSSES.map((l) => (
          <Key key={l.id} color={l.color} label={l.name} shape="line" />
        ))}
      </div>
    </Panel>
  );
}

// ---------- fc-mint ----------

const RMETHODS: { id: ReconMethod; name: string }[] = [
  { id: "bottomup", name: "Bottom-up" },
  { id: "topdown", name: "Top-down" },
  { id: "ols", name: "OLS" },
  { id: "wls", name: "MinT (WLS)" },
];

export function Reconciler() {
  const [total, setTotal] = useState(100);
  const [a, setA] = useState(60);
  const [b, setB] = useState(45);
  const [sdT, setSdT] = useState(5);
  const [method, setMethod] = useState<ReconMethod>("wls");
  const vars = [sdT * sdT, 16, 9];
  const rec = reconcile3([total, a, b], vars, method);
  const base = [total, a, b];
  const names = ["Total", "Store A", "Store B"];
  const x = linear([0, 3], [L, R]);
  const y = linear([0, 140], [B, 10]);
  const fmt = (v: number) => String(Number(v.toFixed(2)));
  return (
    <Panel
      title="Two stores and their total, each forecast by a different team. The forecasts don't add up"
      footer={
        <>
          Base: A + B = {a + b} but the total says {total}, a gap of <span className="font-semibold tabular" data-testid="rc-gap">{total - a - b}</span>. Reconciled: total{" "}
          <span className="font-semibold tabular" data-testid="rc-total">{fmt(rec[0])}</span> = A{" "}
          <span className="font-semibold tabular" data-testid="rc-a">{fmt(rec[1])}</span> + B{" "}
          <span className="font-semibold tabular" data-testid="rc-b">{fmt(rec[2])}</span>. Error sds: total {sdT}, A 4, B 3.
        </>
      }
    >
      <Radios label="Method" value={method} onChange={setMethod} options={RMETHODS} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider id="rc-base-total" label="Base forecast: total" value={total} min={80} max={120} step={1} onChange={setTotal} />
        <Slider id="rc-base-a" label="Base forecast: store A" value={a} min={40} max={80} step={1} onChange={setA} />
        <Slider id="rc-base-b" label="Base forecast: store B" value={b} min={30} max={60} step={1} onChange={setB} />
        <Slider id="rc-sd" label="Total's forecast error sd" value={sdT} min={1} max={10} step={1} onChange={setSdT} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Base and reconciled forecasts at each node">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 40, 80, 120]} label="units" />
        {names.map((n, i) => (
          <g key={n}>
            <rect x={x(i) + 18} width={(x(1) - x(0)) / 2 - 22} y={y(base[i])} height={B - y(base[i])} fill="var(--seq-250)" />
            <rect x={x(i) + (x(1) - x(0)) / 2} width={(x(1) - x(0)) / 2 - 22} y={y(rec[i])} height={B - y(rec[i])} fill="var(--series-1)" />
            <text x={x(i + 0.5)} y={B + 15} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {n}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-250)" label="Base forecast" shape="bar" />
        <Key color="var(--series-1)" label="Reconciled (adds up)" shape="bar" />
      </div>
    </Panel>
  );
}

export const MT_REPS = 20000;
export const MT_SEED = 2;
const MT_METHODS = [
  { id: "base", name: "Base (not coherent)", color: "var(--seq-250)" },
  { id: "bottomup", name: "Bottom-up", color: "var(--series-2)" },
  { id: "ols", name: "OLS", color: "var(--series-1)" },
  { id: "wls", name: "MinT (WLS)", color: "var(--series-3)" },
] as const;

export function MinTStudy() {
  const res = useMemo(() => mintStudy(MT_REPS, MT_SEED), []);
  const levels = [
    { id: "total", name: "Total" },
    { id: "regions", name: "Region" },
    { id: "stores", name: "Store" },
  ] as const;
  const gx = linear([0, 3], [L, R]);
  const y = linear([0, 32], [B, 10]);
  const bw = (gx(1) - gx(0) - 24) / 4;
  return (
    <Panel
      title={`Total → 2 regions → 4 stores, every node forecast separately: ${MT_REPS.toLocaleString("en-IN")} simulated weeks`}
      footer={
        <>
          Forecast error (RMSE) at the total: base <span className="font-semibold tabular" data-testid="mt-base-total">{res.base.total.toFixed(1)}</span>, bottom-up{" "}
          <span className="font-semibold tabular" data-testid="mt-bu-total">{res.bottomup.total.toFixed(1)}</span>, OLS{" "}
          <span className="font-semibold tabular" data-testid="mt-ols-total">{res.ols.total.toFixed(1)}</span>, MinT{" "}
          <span className="font-semibold tabular" data-testid="mt-wls-total">{res.wls.total.toFixed(1)}</span>. At a store: base {res.base.stores.toFixed(1)}, MinT{" "}
          <span className="font-semibold tabular" data-testid="mt-wls-stores">{res.wls.stores.toFixed(1)}</span>. Each node&apos;s own forecaster has error sd {MINT_SD[0]} (total),{" "}
          {MINT_SD[1]} (regions) and {MINT_SD[3]} (stores).
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="RMSE at each level by reconciliation method">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 10, 20, 30]} label="RMSE (units)" />
        {levels.map((lv, i) => (
          <g key={lv.id}>
            {MT_METHODS.map((m, j) => {
              const v = res[m.id][lv.id];
              return <rect key={m.id} x={gx(i) + 12 + j * bw} width={bw - 3} y={y(v)} height={B - y(v)} fill={m.color} />;
            })}
            <text x={gx(i + 0.5)} y={B + 15} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {lv.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {MT_METHODS.map((m) => (
          <Key key={m.id} color={m.color} label={m.name} shape="bar" />
        ))}
      </div>
    </Panel>
  );
}

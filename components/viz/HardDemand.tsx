"use client";

import { useMemo, useState } from "react";
import {
  censoredLogLik,
  croston,
  DRILL,
  drillMean,
  drillSeries,
  estimates,
  intermittentStudy,
  sesForecasts,
  shelfDays,
  spiral,
  tsb,
} from "@/lib/sim/demand";
import { Axis, Key, linear, Panel, Slider } from "./kit";

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

// ---------- fc-censored-demand ----------

export const CS_DAYS = 56;
export const CS_SEED = 7;

export function CensoredShelf() {
  const [lambda, setLambda] = useState(12);
  const [shelf, setShelf] = useState(12);
  const d = useMemo(() => shelfDays(lambda, shelf, CS_DAYS, CS_SEED), [lambda, shelf]);
  const e = useMemo(() => estimates(d.sales, shelf), [d, shelf]);
  const curve = useMemo(() => {
    const ls = Array.from({ length: 121 }, (_, i) => 4 + i * 0.15);
    const ll = ls.map((l) => censoredLogLik(d.sales, shelf, l));
    const top = Math.max(...ll);
    return ls.map((l, i) => [l, ll[i] - top] as const);
  }, [d, shelf]);
  const x = linear([0.5, CS_DAYS + 0.5], [L, R]);
  const top = Math.max(26, ...d.demand) + 1;
  const y = linear([0, top], [B, 10]);
  const cx = linear([4, 22], [L, R]);
  const cy = linear([-12, 0], [B, 10]);
  const marks = [
    { v: e.naive, c: "var(--series-2)", id: "naive" },
    { v: e.dropped, c: "var(--critical)", id: "dropped" },
    { v: e.mle, c: "var(--series-3)", id: "mle" },
    { v: lambda, c: "var(--ink)", id: "truth" },
  ];
  return (
    <Panel
      title="Eight weeks of one paint SKU. The shelf is refilled to the same height every morning"
      footer={
        <>
          Sold out on <span className="font-semibold tabular" data-testid="cs-out">{Math.round(e.stockouts * 100)}%</span> of days. Estimated daily demand: average of sales{" "}
          <span className="font-semibold tabular" data-testid="cs-naive">{e.naive.toFixed(2)}</span>, average of the days that didn&apos;t sell out{" "}
          <span className="font-semibold tabular" data-testid="cs-dropped">{Number.isNaN(e.dropped) ? "none" : e.dropped.toFixed(2)}</span>, censored likelihood{" "}
          <span className="font-semibold tabular" data-testid="cs-mle">{e.mle.toFixed(2)}</span>. True: {lambda}.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider id="cs-lambda" label="True demand (units / day)" value={lambda} min={6} max={18} step={1} onChange={setLambda} />
        <Slider id="cs-shelf" label="Shelf holds" value={shelf} min={8} max={20} step={1} onChange={setShelf} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Daily sales, with sold-out days and the demand they hid">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="units / day" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[1, 14, 28, 42, 56]} label="day" />
        {d.sales.map((s, i) => {
          const out = s >= shelf;
          return (
            <g key={i}>
              <rect x={x(i + 1) - 2.6} width={5.2} y={y(s)} height={B - y(s)} fill={out ? "var(--series-2)" : "var(--seq-250)"} />
              {out && d.demand[i] > s && <line x1={x(i + 1)} x2={x(i + 1)} y1={y(s)} y2={y(d.demand[i])} stroke="var(--series-2)" strokeDasharray="2 2" />}
              {out && <circle cx={x(i + 1)} cy={y(d.demand[i])} r={2.4} fill="none" stroke="var(--series-2)" />}
            </g>
          );
        })}
        <line x1={L} x2={R} y1={y(shelf)} y2={y(shelf)} stroke="var(--ink)" strokeDasharray="4 3" />
      </svg>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label="Censored log-likelihood of each demand rate">
        <Axis scale={cy} orient="left" at={L} gridTo={R} tickValues={[-12, -8, -4, 0]} label="log-likelihood" />
        <Axis scale={cx} orient="bottom" at={B} tickValues={[4, 8, 12, 16, 20]} label="daily demand rate λ" />
        <path d={path(curve.filter(([, v]) => v >= -12).map(([l, v]) => [cx(l), cy(v)]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        {marks.map((m) => (Number.isNaN(m.v) ? null : <line key={m.id} x1={cx(m.v)} x2={cx(m.v)} y1={10} y2={B} stroke={m.c} strokeWidth={2} strokeDasharray={m.id === "truth" ? "4 3" : undefined} />))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-2)" label="Sold out (open circle: the demand nobody saw)" shape="bar" />
        <Key color="var(--series-1)" label="Censored log-likelihood" shape="line" />
        <Key color="var(--critical)" label="Mean of days that didn't sell out" shape="line" />
        <Key color="var(--series-3)" label="Censored likelihood's best λ" shape="line" />
        <Key color="var(--ink)" label="Shelf / true λ" shape="line" />
      </div>
    </Panel>
  );
}

export const SP_WEEKS = 16;
export const SP_SEED = 5;
export const SP_LAMBDA = 12;

export function ShelfSpiral() {
  const naive = useMemo(() => spiral(SP_LAMBDA, SP_WEEKS, "naive", SP_SEED), []);
  const mle = useMemo(() => spiral(SP_LAMBDA, SP_WEEKS, "mle", SP_SEED), []);
  const x = linear([1, SP_WEEKS], [L, R]);
  const y = linear([6, 16], [B, 10]);
  // A step line: each week's shelf holds flat across that week.
  const line = (v: number[]) => path(v.flatMap((s, i) => [[x(Math.max(1, i + 0.5)), y(s)], [x(Math.min(SP_WEEKS, i + 1.5)), y(s)]] as [number, number][]));
  return (
    <Panel
      title="The spiral: set each week's shelf to the forecast, then forecast from what sold"
      footer={
        <>
          Demand is 12 a day all along. Forecasting from raw sales, the shelf shrinks to <span className="font-semibold tabular" data-testid="sp-naive-end">{naive.shelves[SP_WEEKS - 1]}</span> and{" "}
          <span className="font-semibold tabular" data-testid="sp-naive-lost">{(naive.lostShare * 100).toFixed(1)}%</span> of demand walks out. With the censored likelihood it stays near 12, and{" "}
          <span className="font-semibold tabular" data-testid="sp-mle-lost">{(mle.lostShare * 100).toFixed(1)}%</span> is lost (a shelf at the mean still runs out on busy days).
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Shelf size week by week under each forecast">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[6, 8, 10, 12, 14, 16]} label="shelf (units)" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[1, 4, 8, 12, 16]} label="week" />
        <line x1={L} x2={R} y1={y(SP_LAMBDA)} y2={y(SP_LAMBDA)} stroke="var(--ink)" strokeDasharray="4 3" />
        <path d={line(naive.shelves)} fill="none" stroke="var(--series-2)" strokeWidth={2.4} />
        <path d={line(mle.shelves)} fill="none" stroke="var(--series-3)" strokeWidth={2.4} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-2)" label="Forecast = average of sales" shape="line" />
        <Key color="var(--series-3)" label="Forecast = censored likelihood" shape="line" />
        <Key color="var(--ink)" label="True demand, 12 a day" shape="line" />
      </div>
    </Panel>
  );
}

// ---------- fc-intermittent ----------

export const DR_SEED = 11;
type IMethod = "ses" | "croston" | "sba" | "tsb";
const IMETHODS: { id: IMethod; name: string }[] = [
  { id: "ses", name: "SES" },
  { id: "croston", name: "Croston" },
  { id: "sba", name: "SBA" },
  { id: "tsb", name: "TSB" },
];

export function intermittentForecast(method: IMethod, y: number[], alpha: number): (number | null)[] {
  if (method === "ses") return sesForecasts(y, alpha, drillMean);
  if (method === "croston") return croston(y, alpha).forecast;
  if (method === "sba") return croston(y, alpha, true).forecast;
  return tsb(y, alpha, alpha).forecast;
}

export function DrillForecasts() {
  const y = useMemo(() => drillSeries(DR_SEED), []);
  const [method, setMethod] = useState<IMethod>("croston");
  const [alpha, setAlpha] = useState(0.1);
  const f = intermittentForecast(method, y, alpha);
  const after = f.slice(DRILL.stopAt, DRILL.weeks).reduce<number>((s, v) => s + (v ?? 0), 0);
  const x = linear([0.5, DRILL.weeks + 0.5], [L, R]);
  const yy = linear([0, 8], [120, 10]);
  const fy = linear([0, 1.5], [B, 10]);
  return (
    <Panel
      title="Two years of a premium drill's weekly sales. It's discontinued after week 78"
      footer={
        <>
          Forecast going into week 79: <span className="font-semibold tabular" data-testid="dr-78">{(f[DRILL.stopAt] ?? 0).toFixed(3)}</span> a week (true rate {drillMean}). After a
          further 26 weeks of zeros: <span className="font-semibold tabular" data-testid="dr-end">{(f[DRILL.weeks] ?? 0).toFixed(3)}</span>. Units the forecast would have ordered for the dead
          weeks: <span className="font-semibold tabular" data-testid="dr-dead">{after.toFixed(1)}</span>.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <Radios label="Method" value={method} onChange={setMethod} options={IMETHODS} />
        <Slider id="dr-alpha" label="Smoothing α" value={alpha} min={0.05} max={0.3} step={0.05} onChange={(v) => setAlpha(Number(v.toFixed(2)))} display={(v) => v.toFixed(2)} />
      </div>
      <svg viewBox={`0 0 ${VW} 130`} className="mt-3 h-auto w-full" role="img" aria-label="Weekly sales">
        <Axis scale={yy} orient="left" at={L} gridTo={R} tickValues={[0, 4, 8]} label="sold" />
        <rect x={x(DRILL.stopAt + 0.5)} width={R - x(DRILL.stopAt + 0.5)} y={10} height={110} fill="var(--accent-wash)" />
        {y.map((v, t) => (v > 0 ? <rect key={t} x={x(t + 1) - 1.6} width={3.2} y={yy(v)} height={120 - yy(v)} fill="var(--seq-250)" /> : null))}
        <line x1={L} x2={R} y1={120} y2={120} stroke="var(--axis)" />
      </svg>
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="The forecast for each week">
        <Axis scale={fy} orient="left" at={L} gridTo={R} tickValues={[0, 0.5, 1, 1.5]} label="forecast / week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[1, 26, 52, 78, 104]} label="week" />
        <rect x={x(DRILL.stopAt + 0.5)} width={R - x(DRILL.stopAt + 0.5)} y={10} height={B - 10} fill="var(--accent-wash)" />
        <line x1={L} x2={R} y1={fy(drillMean)} y2={fy(drillMean)} stroke="var(--ink)" strokeDasharray="4 3" />
        <path d={path(f.slice(0, DRILL.weeks).flatMap((v, t) => (v === null ? [] : [[x(t + 1), fy(Math.min(v, 1.5))] as [number, number]])))} fill="none" stroke="var(--series-2)" strokeWidth={2.2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-250)" label="A week with sales (units)" shape="bar" />
        <Key color="var(--series-2)" label="Forecast for the week" shape="line" />
        <Key color="var(--ink)" label="True rate while on sale, 0.75" shape="line" />
        <Key color="var(--accent-wash)" label="Discontinued" shape="bar" />
      </div>
    </Panel>
  );
}

export const IS_SERIES = 1000;
export const IS_ALPHA = 0.1;
export const IS_SEED = 4;

export function IntermittentStudy() {
  const res = useMemo(() => intermittentStudy(IS_SERIES, IS_ALPHA, IS_SEED), []);
  const rows = IMETHODS.map((m) => ({ ...m, ...res[m.id] }));
  const x = linear([0, 0.9], [96, R - 44]);
  return (
    <Panel
      title={`${IS_SERIES.toLocaleString("en-IN")} simulated drills that never stop selling (true rate 0.75), α = ${IS_ALPHA}`}
      footer={
        <>
          Average forecast: {rows.map((r, i) => (
            <span key={r.id}>
              {r.name} <span className="font-semibold tabular" data-testid={`is-mean-${r.id}`}>{r.mean.toFixed(3)}</span>
              {i < rows.length - 1 ? ", " : ". "}
            </span>
          ))}
          Typical distance from 0.75 in any one week (RMSE): {rows.map((r, i) => (
            <span key={r.id}>
              {r.name} <span className="font-semibold tabular" data-testid={`is-rmse-${r.id}`}>{r.rmse.toFixed(3)}</span>
              {i < rows.length - 1 ? ", " : "."}
            </span>
          ))}
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} 200`} className="h-auto w-full" role="img" aria-label="Average forecast and RMSE for each method">
        <line x1={x(drillMean)} x2={x(drillMean)} y1={6} y2={176} stroke="var(--ink)" strokeDasharray="4 3" />
        {rows.map((r, k) => (
          <g key={r.id}>
            <text x={88} y={26 + k * 42} textAnchor="end" fontSize={12} fill="var(--ink-2)">
              {r.name}
            </text>
            <rect x={96} y={12 + k * 42} width={x(r.mean) - 96} height={14} rx={3} fill="var(--series-1)" />
            <rect x={96} y={28 + k * 42} width={x(r.rmse) - 96} height={8} rx={2} fill="var(--series-2)" />
            <text x={x(r.mean) + 6} y={24 + k * 42} fontSize={11} fill="var(--ink)" className="tabular">
              {r.mean.toFixed(3)}
            </text>
          </g>
        ))}
        <text x={x(drillMean)} y={192} textAnchor="middle" fontSize={11} fill="var(--muted)">
          true rate 0.75
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Average forecast (units / week)" shape="bar" />
        <Key color="var(--series-2)" label="RMSE against the true rate" shape="bar" />
      </div>
    </Panel>
  );
}

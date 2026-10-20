"use client";

import { useMemo, useState } from "react";
import {
  acf,
  acfBand,
  alphaStar,
  alphaStudy,
  arSd,
  bestAlpha,
  fanPaths,
  halfLife,
  pacf,
  quantile,
  rwSd,
  sd,
  ses,
  sesWeight,
  simulate,
  theoryAcf,
  WEEKLY,
  weeklySeries,
  weeksTo90,
  type Process,
} from "@/lib/sim/forecast";
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

// ---------- fc-ets ----------

export const SES_WEIGHTS = 12;

export function SESExplorer() {
  const y = useMemo(() => weeklySeries(), []);
  const best = useMemo(() => bestAlpha(y), [y]);
  const curve = useMemo(() => Array.from({ length: 96 }, (_, i) => (i + 5) / 100).map((a) => [a, ses(y, a).rmse] as const), [y]);
  const [alpha, setAlpha] = useState(0.3);
  const fit = ses(y, alpha);
  const x = linear([1, y.length], [L, R]);
  const ys = linear([2300, 3050], [B, 10]);
  const wx = linear([-0.5, SES_WEIGHTS - 0.5], [L, R]);
  const wy = linear([0, 1], [B, 10]);
  const cx = linear([0, 1], [L, R]);
  const cy = linear([95, 145], [B, 10]);
  return (
    <Panel
      title="A year of weekly sales at the Pune store. A competitor opens in week 31"
      footer={
        <>
          α = {alpha.toFixed(2)}: one-week-ahead RMSE <span className="font-semibold tabular" data-testid="ses-rmse">{fit.rmse.toFixed(1)}</span> items. A weight halves every{" "}
          <span className="font-semibold tabular" data-testid="ses-half">{alpha >= 1 ? "0" : halfLife(alpha).toFixed(2)}</span> weeks, and after a sudden shift the level has caught up 90% in{" "}
          <span className="font-semibold tabular" data-testid="ses-90">{weeksTo90(alpha)}</span> weeks. Lowest RMSE on this year: α ={" "}
          <span className="font-semibold tabular" data-testid="ses-best">{best.toFixed(2)}</span>.
        </>
      }
    >
      <Slider id="ses-alpha" label="Smoothing α (weight on the newest week)" value={alpha} min={0.05} max={1} step={0.05} onChange={(v) => setAlpha(Number(v.toFixed(2)))} display={(v) => v.toFixed(2)} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Weekly sales and the smoothed forecast">
        <Axis scale={ys} orient="left" at={L} gridTo={R} tickValues={[2400, 2600, 2800, 3000]} label="items / week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[1, 13, 26, 31, 39, 52]} label="week" />
        <line x1={x(WEEKLY.shiftWeek - 0.5)} x2={x(WEEKLY.shiftWeek - 0.5)} y1={10} y2={B} stroke="var(--critical)" strokeDasharray="4 3" />
        {y.map((v, t) => (
          <circle key={t} cx={x(t + 1)} cy={ys(v)} r={2.6} fill="var(--series-1)" opacity={0.75} />
        ))}
        <path d={path(fit.fitted.flatMap((v, t) => (v === null ? [] : [[x(t + 1), ys(v)] as [number, number]])))} fill="none" stroke="var(--series-2)" strokeWidth={2.2} />
      </svg>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Weight on each past week">
          <Axis scale={wy} orient="left" at={L} gridTo={R} tickValues={[0, 0.25, 0.5, 0.75, 1]} label="weight" />
          <Axis scale={wx} orient="bottom" at={B} tickValues={[0, 2, 4, 6, 8, 10]} label="weeks back" />
          {Array.from({ length: SES_WEIGHTS }, (_, j) => (
            <rect key={j} x={wx(j) - 10} width={20} y={wy(sesWeight(alpha, j))} height={B - wy(sesWeight(alpha, j))} fill="var(--series-3)" />
          ))}
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="One-week-ahead RMSE for every alpha">
          <Axis scale={cy} orient="left" at={L} gridTo={R} tickValues={[100, 120, 140]} label="RMSE" />
          <Axis scale={cx} orient="bottom" at={B} tickValues={[0, 0.25, 0.5, 0.75, 1]} label="α" />
          <path d={path(curve.map(([a, v]) => [cx(a), cy(Math.min(v, 145))]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
          <circle cx={cx(alpha)} cy={cy(Math.min(fit.rmse, 145))} r={5} fill="var(--series-2)" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Actual week" />
        <Key color="var(--series-2)" label="Forecast made the week before" shape="line" />
        <Key color="var(--series-3)" label="Weight on that week" shape="bar" />
        <Key color="var(--critical)" label="Competitor opens" shape="line" />
      </div>
    </Panel>
  );
}

export const AS_QS = [0.01, 0.1, 1, 10];
export const AS_REPS = 200;
export const AS_N = 200;
export const AS_SEED = 8;

export function AlphaStudy() {
  const res = useMemo(() => alphaStudy(AS_QS, AS_REPS, AS_N, AS_SEED), []);
  const x = linear([-2.3, 1.3], [L, R]);
  const y = linear([0, 1], [B, 10]);
  const theory = Array.from({ length: 73 }, (_, i) => -2.3 + i * 0.05).map((lq) => [x(lq), y(alphaStar(10 ** lq))] as [number, number]);
  return (
    <Panel
      title={`${AS_REPS} simulated series at each noise level: the α that forecasts best`}
      footer={
        <>
          Average fitted α (theory):{" "}
          {res.map((r, i) => (
            <span key={r.q}>
              q = {r.q}: <span className="font-semibold tabular" data-testid={`as-fit-${r.q}`}>{r.fitted.toFixed(3)}</span> ({r.theory.toFixed(3)})
              {i < res.length - 1 ? "; " : "."}
            </span>
          ))}{" "}
          q is how much the true level moves each week compared with the week-to-week noise (both as variances).
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Best alpha against the signal-to-noise ratio">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 0.25, 0.5, 0.75, 1]} label="best α" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[-2, -1, 0, 1]} format={(v) => `${10 ** v}`} label="q = level movement / noise (log scale)" />
        <path d={path(theory)} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        {res.map((r) => (
          <g key={r.q}>
            <line x1={x(Math.log10(r.q))} x2={x(Math.log10(r.q))} y1={y(r.fitted - r.spread)} y2={y(r.fitted + r.spread)} stroke="var(--series-2)" strokeWidth={2} />
            <circle cx={x(Math.log10(r.q))} cy={y(r.fitted)} r={5} fill="var(--series-2)" />
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Theory: α* = (−q + √(q² + 4q)) / 2" shape="line" />
        <Key color="var(--series-2)" label="Fitted by grid search (± one sd across series)" />
      </div>
    </Panel>
  );
}

// ---------- fc-arima ----------

export const AP_N = 200;
export const AP_SEED = 9;
export const AP_LAGS = 12;

const PROCESSES: { id: Process; name: string }[] = [
  { id: "ar1", name: "AR(1)" },
  { id: "ma1", name: "MA(1)" },
  { id: "rw", name: "Random walk" },
  { id: "diff", name: "Walk, differenced" },
];

function Bars({ values, theory, band, label, testid }: { values: number[]; theory?: (number | null)[]; band: number; label: string; testid: string }) {
  const x = linear([0.5, AP_LAGS + 0.5], [L, R]);
  const y = linear([-1, 1], [B, 10]);
  return (
    <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label={label} data-testid={testid}>
      <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[-1, -0.5, 0, 0.5, 1]} label={label} />
      <Axis scale={x} orient="bottom" at={B} tickValues={[1, 3, 6, 9, 12]} label="lag" />
      <rect x={L} width={R - L} y={y(band)} height={y(-band) - y(band)} fill="var(--accent-wash)" />
      {values.map((v, i) => (
        <rect key={i} x={x(i + 1) - 6} width={12} y={Math.min(y(v), y(0))} height={Math.abs(y(v) - y(0))} fill="var(--series-1)" />
      ))}
      {theory?.map((v, i) => (v === null ? null : <circle key={i} cx={x(i + 1)} cy={y(v)} r={4} fill="none" stroke="var(--series-2)" strokeWidth={2} />))}
      <line x1={L} x2={R} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
    </svg>
  );
}

export function ACFPACFLab() {
  const [process, setProcess] = useState<Process>("ar1");
  const [coef, setCoef] = useState(0.6);
  const y = useMemo(() => simulate(process, coef, AP_N, AP_SEED), [process, coef]);
  const r = acf(y, AP_LAGS).slice(1);
  const p = pacf(y, AP_LAGS);
  const th = theoryAcf(process, coef, AP_LAGS);
  const band = acfBand(AP_N);
  const uses = process === "ar1" || process === "ma1";
  const lo = Math.min(...y);
  const hi = Math.max(...y);
  const x = linear([0, AP_N - 1], [L, R]);
  return (
    <Panel
      title="Four kinds of week-to-week memory, 200 weeks each, all driven by the same random shocks"
      footer={
        <>
          r<sub>1</sub> = <span className="font-semibold tabular" data-testid="ap-r1">{r[0].toFixed(2)}</span>, r<sub>2</sub> ={" "}
          <span className="font-semibold tabular" data-testid="ap-r2">{r[1].toFixed(2)}</span>
          {th[0] !== null && (
            <>
              {" "}
              (theory <span className="font-semibold tabular" data-testid="ap-t1">{th[0].toFixed(2)}</span>, {(th[1] as number).toFixed(2)})
            </>
          )}
          . Partial autocorrelation at lag 2: <span className="font-semibold tabular" data-testid="ap-p2">{p[1].toFixed(2)}</span>. Bars inside the shaded band (±{band.toFixed(2)}) are
          indistinguishable from zero.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <Radios label="Process" value={process} onChange={setProcess} options={PROCESSES} />
        {uses ? (
          <Slider id="ap-coef" label={process === "ar1" ? "φ (memory of last week's level)" : "θ (memory of last week's shock)"} value={coef} min={-0.9} max={0.9} step={0.1} onChange={(v) => setCoef(Number(v.toFixed(1)))} display={(v) => v.toFixed(1)} />
        ) : (
          <p className="text-sm text-ink-2">A random walk has no coefficient: this week = last week + a shock.</p>
        )}
      </div>
      <svg viewBox={`0 0 ${VW} 170`} className="mt-3 h-auto w-full" role="img" aria-label="The simulated series">
        {(() => {
          const ys2 = linear([lo, hi], [140, 10]);
          return <path d={path(y.map((v, t) => [x(t), ys2(v)]))} fill="none" stroke="var(--series-1)" strokeWidth={1.2} opacity={0.8} />;
        })()}
        <line x1={L} x2={R} y1={140} y2={140} stroke="var(--axis)" />
        <text x={(L + R) / 2} y={160} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
          week
        </text>
      </svg>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <Bars values={r} theory={th} band={band} label="ACF" testid="ap-acf" />
        <Bars values={p} band={band} label="PACF" testid="ap-pacf" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Sample value" shape="bar" />
        <Key color="var(--series-2)" label="Theory (ACF)" />
        <Key color="var(--accent-wash)" label="Noise band, ±1.96/√n" shape="bar" />
      </div>
    </Panel>
  );
}

export const FF = { phi: 0.6, mu: 2800, last: 3000, sigma: 100, H: 26, paths: 2000, seed: 31 };
export const FF_SHOW = [1, 4, 13, 26];

export function ForecastFan() {
  const [kind, setKind] = useState<"ar" | "rw">("ar");
  const phi = kind === "ar" ? FF.phi : 1;
  const P = useMemo(() => fanPaths(phi, FF.mu, FF.last, FF.sigma, FF.H, FF.paths, FF.seed), [phi]);
  const bands = Array.from({ length: FF.H }, (_, h) => {
    const col = P.map((p) => p[h]);
    return { lo: quantile(col, 0.05), mid: quantile(col, 0.5), hi: quantile(col, 0.95), sd: sd(col) };
  });
  const x = linear([0, FF.H], [L, R]);
  const y = linear([1800, 4200], [B, 10]);
  const area = [
    [x(0), y(FF.last)],
    ...bands.map((b, h) => [x(h + 1), y(b.hi)]),
    ...bands.map((b, h) => [x(h + 1), y(b.lo)]).reverse(),
    [x(0), y(FF.last)],
  ] as [number, number][];
  return (
    <Panel
      title={`${FF.paths.toLocaleString("en-IN")} simulated futures from a week that sold 3,000 (normal is 2,800): the 90% fan`}
      footer={
        <>
          Spread of the simulated futures (theory):{" "}
          {FF_SHOW.map((h, i) => (
            <span key={h}>
              {h} week{h === 1 ? "" : "s"} ahead <span className="font-semibold tabular" data-testid={`ff-sd-${h}`}>{bands[h - 1].sd.toFixed(0)}</span> (
              {(kind === "ar" ? arSd(FF.phi, FF.sigma, h) : rwSd(FF.sigma, h)).toFixed(0)}){i < FF_SHOW.length - 1 ? ", " : "."}
            </span>
          ))}{" "}
          Median forecast at 26 weeks: <span className="font-semibold tabular" data-testid="ff-mid">{Math.round(bands[FF.H - 1].mid).toLocaleString("en-IN")}</span>.
        </>
      }
    >
      <Radios
        label="Model"
        value={kind}
        onChange={setKind}
        options={[
          { id: "ar", name: `AR(1), φ = ${FF.phi}` },
          { id: "rw", name: "Random walk (φ = 1)" },
        ]}
      />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Fan chart of simulated futures">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[2000, 2500, 3000, 3500, 4000]} label="items / week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[0, 4, 13, 26]} label="weeks ahead" />
        <path d={path(area)} fill="var(--series-1)" opacity={0.18} />
        {P.slice(0, 12).map((p, j) => (
          <path key={j} d={path([[x(0), y(FF.last)], ...p.map((v, h) => [x(h + 1), y(Math.max(1800, Math.min(4200, v)))] as [number, number])])} fill="none" stroke="var(--seq-250)" strokeWidth={1} />
        ))}
        <path d={path([[x(0), y(FF.last)], ...bands.map((b, h) => [x(h + 1), y(b.mid)] as [number, number])])} fill="none" stroke="var(--series-2)" strokeWidth={2.4} />
        <line x1={L} x2={R} y1={y(FF.mu)} y2={y(FF.mu)} stroke="var(--ink)" strokeDasharray="4 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="90% of futures" shape="bar" />
        <Key color="var(--seq-250)" label="A few single futures" shape="line" />
        <Key color="var(--series-2)" label="Median forecast" shape="line" />
        <Key color="var(--ink)" label="Long-run mean, 2,800" shape="line" />
      </div>
    </Panel>
  );
}

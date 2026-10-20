"use client";

import { useMemo, useState } from "react";
import {
  acf,
  acfBand,
  constantScores,
  decompose,
  DOW,
  holdoutStudy,
  lagPairs,
  METHODS,
  noiseStudy,
  ORIGINS,
  pairCorr,
  rollingOrigin,
  sd,
  storeSeries,
  wiggle,
  type Method,
} from "@/lib/sim/forecast";
import { Axis, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 230;
const L = 44;
const B = H - 32;
const R = VW - 12;

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

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

// ---------- fc-anatomy ----------

export const DC_WINDOWS = [3, 5, 7, 9, 14, 28];

export function Decomposer() {
  const y = useMemo(() => storeSeries(), []);
  const [wi, setWi] = useState(0);
  const w = DC_WINDOWS[wi];
  const d = useMemo(() => decompose(y, w), [y, w]);
  const rem = d.remainder.filter((v): v is number => v !== null);
  const x = linear([0, y.length - 1], [L, R]);
  const ys = linear([300, 650], [B, 10]);
  const trendPts = d.trend.flatMap((v, t) => (v === null ? [] : [[x(t), ys(v)] as [number, number]]));
  const bx = linear([0, 7], [L, R]);
  const by = linear([-100, 100], [B, 10]);
  const rx = linear([0, y.length - 1], [L, R]);
  const ry = linear([-60, 60], [B, 10]);
  return (
    <Panel
      title="16 weeks at the Pune store, taken apart: sales = trend + weekday pattern + remainder"
      footer={
        <>
          Saturday&apos;s effect: <span className="font-semibold tabular" data-testid="dc-sat">{d.index[5] >= 0 ? "+" : ""}{d.index[5].toFixed(1)}</span> items (planted: +80).
          Day-to-day wiggle in the trend: <span className="font-semibold tabular" data-testid="dc-wiggle">{wiggle(d.trend).toFixed(2)}</span> items. Remainder sd:{" "}
          <span className="font-semibold tabular" data-testid="dc-rem">{sd(rem).toFixed(2)}</span> items.
        </>
      }
    >
      <Slider id="dc-window" label="Moving-average window" value={wi} min={0} max={DC_WINDOWS.length - 1} step={1} onChange={setWi} display={(i) => `${DC_WINDOWS[i]} days`} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Daily sales with the moving-average trend">
        <Axis scale={ys} orient="left" at={L} gridTo={R} label="items / day" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[0, 28, 56, 84, 111]} format={(v) => `${v + 1}`} label="day" />
        <path d={path(y.map((v, t) => [x(t), ys(v)]))} fill="none" stroke="var(--series-1)" strokeWidth={1.2} opacity={0.7} />
        <path d={path(trendPts)} fill="none" stroke="var(--series-2)" strokeWidth={2.4} />
      </svg>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Weekday pattern">
          <Axis scale={by} orient="left" at={L} gridTo={R} tickValues={[-100, -50, 0, 50, 100]} label="items vs trend" />
          {d.index.map((v, i) => (
            <g key={i}>
              <rect x={bx(i) + 6} width={bx(1) - bx(0) - 12} y={Math.min(by(v), by(0))} height={Math.abs(by(v) - by(0))} fill={v >= 0 ? "var(--series-3)" : "var(--seq-250)"} />
              <text x={bx(i + 0.5)} y={B + 15} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {DOW[i]}
              </text>
            </g>
          ))}
          <line x1={L} x2={R} y1={by(0)} y2={by(0)} stroke="var(--axis)" />
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Remainder by day">
          <Axis scale={ry} orient="left" at={L} gridTo={R} tickValues={[-60, -30, 0, 30, 60]} label="remainder" />
          <Axis scale={rx} orient="bottom" at={B} tickValues={[0, 28, 56, 84, 111]} format={(v) => `${v + 1}`} label="day" />
          <path d={path(d.remainder.flatMap((v, t) => (v === null ? [] : [[rx(t), ry(Math.max(-60, Math.min(60, v)))] as [number, number]])))} fill="none" stroke="var(--series-1)" strokeWidth={1.2} />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Daily sales; remainder" shape="line" />
        <Key color="var(--series-2)" label="Trend (moving average)" shape="line" />
        <Key color="var(--series-3)" label="Weekday above trend" shape="bar" />
        
      </div>
    </Panel>
  );
}

export const ACF_LAGS = 28;

export function ACFExplorer() {
  const y = useMemo(() => storeSeries(), []);
  const rem = useMemo(() => decompose(y, 7).remainder.filter((v): v is number => v !== null), [y]);
  const [which, setWhich] = useState<"raw" | "rem">("raw");
  const [k, setK] = useState(1);
  const s = which === "raw" ? y : rem;
  const r = useMemo(() => acf(s, ACF_LAGS), [s]);
  const pairs = lagPairs(s, k);
  const band = acfBand(s.length);
  const S = 300;
  const [lo, hi] = which === "raw" ? [320, 640] : [-50, 50];
  const px = linear([lo, hi], [40, S - 10]);
  const py = linear([lo, hi], [S - 34, 10]);
  const ax = linear([0.5, ACF_LAGS + 0.5], [L, R]);
  const ay = linear([-0.6, 1], [B, 10]);
  return (
    <Panel
      title="What the ACF computes: line each day up with the day k days earlier"
      footer={
        <>
          Lag {k}: <span className="font-semibold tabular" data-testid="acf-pairs">{pairs.length}</span> pairs, autocorrelation r<sub>{k}</sub> ={" "}
          <span className="font-semibold tabular" data-testid="acf-r">{r[k].toFixed(3)}</span> (the pairs&apos; own correlation:{" "}
          <span className="font-semibold tabular" data-testid="acf-pc">{pairCorr(pairs).toFixed(3)}</span>). Pure noise would stay inside ±
          <span className="font-semibold tabular" data-testid="acf-band">{band.toFixed(3)}</span> 95% of the time.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <Radios
          label="Series"
          value={which}
          onChange={setWhich}
          options={[
            { id: "raw", name: "Raw sales" },
            { id: "rem", name: "Remainder" },
          ]}
        />
        <Slider id="acf-lag" label="Lag k (days)" value={k} min={1} max={ACF_LAGS} step={1} onChange={setK} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center">
        <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-auto w-full max-w-[320px]" role="img" aria-label={`Scatter of each day against the day ${k} days earlier`}>
          <line x1={px(lo)} x2={px(hi)} y1={py(lo)} y2={py(hi)} stroke="var(--grid)" />
          <line x1={40} x2={S - 10} y1={S - 34} y2={S - 34} stroke="var(--axis)" />
          <line x1={40} x2={40} y1={10} y2={S - 34} stroke="var(--axis)" />
          {pairs.map(([a, b], i) => (
            <circle key={i} cx={px(Math.max(lo, Math.min(hi, a)))} cy={py(Math.max(lo, Math.min(hi, b)))} r={2.6} fill="var(--series-1)" opacity={0.55} />
          ))}
          <text x={(40 + S - 10) / 2} y={S - 18} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {`${k} day${k === 1 ? "" : "s"} earlier`}
          </text>
          <text x={14} y={(S - 34) / 2} textAnchor="middle" fontSize={11} fill="var(--muted)" transform={`rotate(-90 14 ${(S - 34) / 2})`}>
            today
          </text>
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Autocorrelation at lags 1 to 28">
          <Axis scale={ay} orient="left" at={L} gridTo={R} tickValues={[-0.5, 0, 0.5, 1]} label="autocorrelation" />
          <Axis scale={ax} orient="bottom" at={B} tickValues={[1, 7, 14, 21, 28]} label="lag (days)" />
          <rect x={L} width={R - L} y={ay(band)} height={ay(-band) - ay(band)} fill="var(--accent-wash)" />
          {r.slice(1).map((v, i) => (
            <rect
              key={i}
              x={ax(i + 1) - 4}
              width={8}
              y={Math.min(ay(v), ay(0))}
              height={Math.abs(ay(v) - ay(0))}
              fill={i + 1 === k ? "var(--series-2)" : "var(--seq-250)"}
            />
          ))}
          <line x1={L} x2={R} y1={ay(0)} y2={ay(0)} stroke="var(--axis)" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="One pair (k days earlier, today)" />
        <Key color="var(--series-2)" label="The lag you picked" shape="bar" />
        <Key color="var(--accent-wash)" label="Noise band, ±1.96/√n" shape="bar" />
      </div>
    </Panel>
  );
}

export const NZ_SERIES = 500;
export const NZ_SEED = 3;

export function NoiseACF() {
  const res = useMemo(() => noiseStudy(NZ_SERIES, 112, ACF_LAGS, NZ_SEED), []);
  const lo = -0.35;
  const hi = 0.35;
  const bins = 28;
  const bw = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const v of res.r7) {
    const i = Math.floor((v - lo) / bw);
    if (i >= 0 && i < bins) counts[i]++;
  }
  const x = linear([lo, hi], [L, R]);
  const y = linear([0, Math.max(...counts) * 1.1], [B, 10]);
  return (
    <Panel
      title={`${NZ_SERIES} series of pure noise, 112 days each: their lag-7 autocorrelation`}
      footer={
        <>
          Spread of r<sub>7</sub>: <span className="font-semibold tabular" data-testid="nz-sd">{sd(res.r7).toFixed(4)}</span> (1/√112 = {(1 / Math.sqrt(112)).toFixed(4)}).
          Across lags 1–28, <span className="font-semibold tabular" data-testid="nz-share">{pct(res.share)}</span> of the bars land outside the band, but{" "}
          <span className="font-semibold tabular" data-testid="nz-any">{pct(res.anyShare)}</span> of the noise series have at least one bar outside it.
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Histogram of lag-7 autocorrelations of pure noise">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="series" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]} label="lag-7 autocorrelation" />
        {counts.map((c, i) => {
          const mid = lo + (i + 0.5) * bw;
          return <rect key={i} x={x(lo + i * bw) + 0.5} y={y(c)} width={Math.max(x(bw) - x(0) - 1, 0)} height={B - y(c)} fill={Math.abs(mid) > res.band ? "var(--series-2)" : "var(--seq-250)"} />;
        })}
        {[-res.band, res.band].map((b) => (
          <line key={b} x1={x(b)} x2={x(b)} y1={10} y2={B} stroke="var(--critical)" strokeDasharray="4 3" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-250)" label="Inside the band" shape="bar" />
        <Key color="var(--series-2)" label="Outside: a 'significant' spike in pure noise" shape="bar" />
        <Key color="var(--critical)" label="±1.96/√n" shape="line" />
      </div>
    </Panel>
  );
}

// ---------- fc-baselines ----------

export function RollingOrigin() {
  const y = useMemo(() => storeSeries(), []);
  const [method, setMethod] = useState<Method>("snaive");
  const [fold, setFold] = useState(ORIGINS.length);
  const ro = useMemo(() => rollingOrigin(y, method), [y, method]);
  const f = ro.folds[fold - 1];
  const from = 42;
  const x = linear([from, y.length - 1], [L, R]);
  const ys = linear([350, 650], [B, 10]);
  const fx = linear([0.5, ORIGINS.length + 0.5], [L, R]);
  return (
    <Panel
      title="Rolling origin: eight times, train on everything before a Monday and forecast the next 7 days"
      footer={
        <>
          Fold {fold} (days {f.origin + 1}–{f.origin + 7}): WAPE <span className="font-semibold tabular" data-testid="ro-fold-wape">{pct(f.wape)}</span>. All eight folds: WAPE{" "}
          <span className="font-semibold tabular" data-testid="ro-wape">{pct(ro.wape)}</span>, bias{" "}
          <span className="font-semibold tabular" data-testid="ro-bias">{ro.bias >= 0 ? "+" : ""}{pct(ro.bias)}</span>, MASE{" "}
          <span className="font-semibold tabular" data-testid="ro-mase">{ro.mase.toFixed(2)}</span> (below 1 beats last week&apos;s sales, scored on the training days).
        </>
      }
    >
      <Radios label="Baseline" value={method} onChange={setMethod} options={METHODS} />
      <div className="mt-3">
        <Slider id="ro-fold" label="Fold" value={fold} min={1} max={ORIGINS.length} step={1} onChange={setFold} display={(v) => `${v} of ${ORIGINS.length}`} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Sales, the training window and the 7-day forecast">
        <rect x={x(from)} width={x(f.origin - 0.5) - x(from)} y={10} height={B - 10} fill="var(--accent-wash)" />
        <Axis scale={ys} orient="left" at={L} gridTo={R} label="items / day" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[42, 56, 70, 84, 98, 111]} format={(v) => `${v + 1}`} label="day" />
        <path d={path(y.slice(from).map((v, i) => [x(from + i), ys(v)]))} fill="none" stroke="var(--series-1)" strokeWidth={1.4} />
        <path d={path(f.fc.map((v, i) => [x(f.origin + i), ys(v)]))} fill="none" stroke="var(--series-2)" strokeWidth={2.4} />
        {f.fc.map((v, i) => (
          <circle key={i} cx={x(f.origin + i)} cy={ys(v)} r={3} fill="var(--series-2)" />
        ))}
      </svg>
      <svg viewBox={`0 0 ${VW} 150`} className="mt-1 h-auto w-full" role="img" aria-label="WAPE of each fold">
        {(() => {
          const fy2 = linear([0, 0.16], [118, 10]);
          return (
            <>
              <Axis scale={fy2} orient="left" at={L} gridTo={R} tickValues={[0, 0.05, 0.1, 0.15]} format={(v) => `${Math.round(v * 100)}%`} label="WAPE" />
              {ro.folds.map((fd, i) => (
                <g key={i}>
                  <rect x={fx(i + 1) - 14} width={28} y={fy2(Math.min(fd.wape, 0.16))} height={118 - fy2(Math.min(fd.wape, 0.16))} fill={i + 1 === fold ? "var(--series-2)" : "var(--seq-250)"} />
                  <text x={fx(i + 1)} y={134} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {i + 1}
                  </text>
                </g>
              ))}
              <line x1={L} x2={R} y1={fy2(ro.wape)} y2={fy2(ro.wape)} stroke="var(--ink)" strokeDasharray="4 3" />
              <text x={(L + R) / 2} y={148} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
                fold
              </text>
            </>
          );
        })()}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--accent-wash)" label="Training days the forecast may use" shape="bar" />
        <Key color="var(--series-1)" label="Actual sales" shape="line" />
        <Key color="var(--series-2)" label="Forecast" shape="line" />
        <Key color="var(--ink)" label="WAPE over all folds" shape="line" />
      </div>
    </Panel>
  );
}

export function SlowMover() {
  const [f, setF] = useState(0.6);
  const s = constantScores(f);
  const fs = Array.from({ length: 41 }, (_, i) => i * 0.05);
  const curves = fs.map((v) => constantScores(v));
  const x = linear([0, 2], [L, R]);
  const y = linear([0, 2.5], [B, 10]);
  return (
    <Panel
      title="A premium drill sells 0.6 a day on average (most days, zero). Forecast the same number every day"
      footer={
        <>
          Forecast {f.toFixed(1)} a day: WAPE <span className="font-semibold tabular" data-testid="sm-wape">{pct(s.wape)}</span>, bias{" "}
          <span className="font-semibold tabular" data-testid="sm-bias">{s.bias >= 0 ? "+" : ""}{pct(s.bias)}</span>, RMSE{" "}
          <span className="font-semibold tabular" data-testid="sm-rmse">{s.rmse.toFixed(3)}</span>. WAPE is lowest at 0, a forecast that would never stock the drill.
        </>
      }
    >
      <Slider id="sm-f" label="Daily forecast" value={f} min={0} max={2} step={0.1} onChange={setF} display={(v) => v.toFixed(1)} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="WAPE and RMSE against the forecast">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 0.5, 1, 1.5, 2, 2.5]} label="score" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[0, 0.5, 1, 1.5, 2]} label="daily forecast" />
        <path d={path(fs.map((v, i) => [x(v), y(curves[i].wape)]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <path d={path(fs.map((v, i) => [x(v), y(curves[i].rmse)]))} fill="none" stroke="var(--series-2)" strokeWidth={2} />
        <line x1={x(0.6)} x2={x(0.6)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
        <line x1={x(f)} x2={x(f)} y1={10} y2={B} stroke="var(--series-3)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="WAPE (as a fraction)" shape="line" />
        <Key color="var(--series-2)" label="RMSE (drills / day)" shape="line" />
        <Key color="var(--ink)" label="True mean, 0.6" shape="line" />
        <Key color="var(--series-3)" label="Your forecast" shape="line" />
      </div>
    </Panel>
  );
}

export const HO_STORES = 300;
export const HO_SEED = 1000;

export function HoldoutStudy() {
  const res = useMemo(() => holdoutStudy(HO_STORES, HO_SEED), []);
  const lo = -0.03;
  const hi = 0.03;
  const bins = 30;
  const bw = (hi - lo) / bins;
  const hist = (xs: number[]) => {
    const c = new Array<number>(bins).fill(0);
    for (const v of xs) {
      const i = Math.floor((v - lo) / bw);
      if (i >= 0 && i < bins) c[i]++;
    }
    return c;
  };
  const a = hist(res.singleErr);
  const b = hist(res.rollingErr);
  const x = linear([lo * 100, hi * 100], [L, R]);
  const y = linear([0, Math.max(...a, ...b) * 1.1], [B, 10]);
  const step = (c: number[]) => path(c.flatMap((v, i) => [[x((lo + i * bw) * 100), y(v)], [x((lo + (i + 1) * bw) * 100), y(v)]] as [number, number][]));
  return (
    <Panel
      title={`${HO_STORES} simulated stores, one recipe: how much of seasonal naive's backtest WAPE is luck?`}
      footer={
        <>
          Seasonal naive&apos;s expected WAPE is {(res.expected.a[1] * 100).toFixed(1)}% (the 4-week weekday average: {(res.expected.b[1] * 100).toFixed(1)}%). Luck in the score (sd): last week only <span className="font-semibold tabular" data-testid="ho-single-sd">{(res.singleSpread * 100).toFixed(2)}</span> points, eight
          rolling folds <span className="font-semibold tabular" data-testid="ho-rolling-sd">{(res.rollingSpread * 100).toFixed(2)}</span> points. Picking between seasonal naive and
          the 4-week weekday average, the last-week test picks the worse one in <span className="font-semibold tabular" data-testid="ho-single-wrong">{pct(res.singleWrong)}</span> of
          stores; eight folds in <span className="font-semibold tabular" data-testid="ho-rolling-wrong">{pct(res.rollingWrong)}</span>.
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Histograms of backtest error for one fold and eight folds">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="stores" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[-3, -2, -1, 0, 1, 2, 3]} format={(v) => `${v > 0 ? "+" : ""}${v}`} label="backtest WAPE − expected WAPE (points)" />
        <path d={step(a)} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <path d={step(b)} fill="none" stroke="var(--series-2)" strokeWidth={2} />
        <line x1={x(0)} x2={x(0)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Scored on the last week only" shape="line" />
        <Key color="var(--series-2)" label="Scored on eight rolling folds" shape="line" />
      </div>
    </Panel>
  );
}

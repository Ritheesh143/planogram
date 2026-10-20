"use client";

import { useMemo, useState } from "react";
import {
  CF,
  conformalStudy,
  HAND_TINS,
  mean,
  nbCover,
  pinballArgmin,
  pinballTotal,
  poissonInterval,
  promoEffect,
  promoForecast,
  promoSkus,
  promoStudy,
  PROMO,
  PS,
  type PromoModel,
  tintDays,
} from "@/lib/sim/uncertainty";
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
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// ---------- fc-pinball ----------

export function PinballDial() {
  const [data, setData] = useState<"hand" | "sim">("hand");
  const [tau, setTau] = useState(0.75);
  const sim = useMemo(() => tintDays(), []);
  const y = data === "hand" ? HAND_TINS : sim;
  const q = pinballArgmin(y, tau);
  const below = y.filter((v) => v <= q).length / y.length;
  const hi = Math.max(...y);
  const counts = Array.from({ length: hi + 1 }, (_, v) => y.filter((s) => s === v).length);
  const x = linear([-0.5, hi + 0.5], [L, R]);
  const yc = linear([0, Math.max(...counts) * 1.15], [B, 10]);
  const qs = Array.from({ length: hi + 1 }, (_, v) => v);
  const loss = qs.map((v) => pinballTotal(y, v, tau) / y.length);
  const yl = linear([0, Math.max(...loss) * 1.05], [B, 10]);
  const m = mean(y);
  return (
    <Panel
      title="Slide τ: the order quantity that minimizes pinball loss is the τ-quantile of sales"
      footer={
        <>
          Pinball loss is lowest at <span className="font-semibold tabular" data-testid="pb-q">{q}</span> tins, and{" "}
          <span className="font-semibold tabular" data-testid="pb-below">{pct(below, 0)}</span> of the days sold that many or fewer (τ ={" "}
          {Math.round(tau * 100)}%). The mean, which squared error picks, is <span className="font-semibold tabular" data-testid="pb-mean">{m.toFixed(1)}</span>.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Radios
          label="Which sales"
          value={data}
          options={[
            { id: "hand", name: "10 days (by hand)" },
            { id: "sim", name: `${sim.length} days` },
          ]}
          onChange={setData}
        />
        <Slider id="pb-tau" label="Quantile level τ" value={tau} min={0.05} max={0.95} step={0.05} onChange={(v) => setTau(Number(v.toFixed(2)))} display={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Histogram of daily sales with the chosen quantile marked">
          <Axis scale={yc} orient="left" at={L} gridTo={R} label="days" tickValues={ticks(0, Math.max(...counts)).filter(Number.isInteger)} />
          <Axis scale={x} orient="bottom" at={B} tickValues={ticks(0, hi)} label="tins sold in a day" />
          {counts.map((c, v) => (
            <rect key={v} x={x(v - 0.4)} width={x(0.8) - x(0)} y={yc(c)} height={B - yc(c)} fill={v <= q ? "var(--series-1)" : "var(--seq-100)"} />
          ))}
          <line x1={x(q)} x2={x(q)} y1={10} y2={B} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={x(m)} x2={x(m)} y1={10} y2={B} stroke="var(--series-2)" strokeDasharray="4 3" strokeWidth={1.5} />
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Average pinball loss for each order quantity">
          <Axis scale={yl} orient="left" at={L} gridTo={R} label="pinball loss per day" />
          <Axis scale={x} orient="bottom" at={B} tickValues={ticks(0, hi)} label="forecast q (tins)" />
          <path d={path(qs.map((v, i) => [x(v), yl(loss[i])]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
          <circle cx={x(q)} cy={yl(loss[q])} r={5} fill="var(--ink)" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Days at or below q" shape="bar" />
        <Key color="var(--seq-100)" label="Days above q" shape="bar" />
        <Key color="var(--ink)" label="Pinball minimum q" shape="line" />
        <Key color="var(--series-2)" label="Mean" shape="line" />
      </div>
    </Panel>
  );
}

export const CF_NS = [9, 19, 39, 99, 199];
export const CF_REPS = 2000;
export const CF_SEED = 3;

export function ConformalCoverage() {
  const [ni, setNi] = useState(0);
  const n = CF_NS[ni];
  const study = useMemo(() => conformalStudy(n, CF_REPS, CF_SEED), [n]);
  const [lo, hi] = poissonInterval();
  const pois = nbCover(lo, hi);
  const bw = 0.02;
  const start = 0.4;
  const bins = Math.round((1 - start) / bw);
  const counts = new Array<number>(bins).fill(0);
  for (const c of study.coverage) counts[Math.max(0, Math.min(bins - 1, Math.floor((c - start) / bw)))]++;
  const x = linear([start, 1], [L, R]);
  const y = linear([0, Math.max(...counts) / CF_REPS * 1.1], [B, 10]);
  return (
    <Panel
      title={`Rerun the calibration ${CF_REPS.toLocaleString("en-IN")} times: the coverage each 80% conformal interval achieves on future weeks`}
      footer={
        <>
          The Poisson 80% interval {lo}–{hi} covers only <span className="font-semibold tabular" data-testid="cf-pois">{pct(pois)}</span> of weeks. Conformal intervals from {n} calibration
          weeks cover <span className="font-semibold tabular" data-testid="cf-mean">{pct(study.mean)}</span> on average; <span className="font-semibold tabular" data-testid="cf-low">{pct(study.low)}</span>{" "}
          of calibration sets give an interval covering under 75%. Average width{" "}
          <span className="font-semibold tabular" data-testid="cf-width">{study.width.toFixed(1)}</span> tins.
        </>
      }
    >
      <Slider id="cf-n" label="Calibration weeks n" value={ni} min={0} max={CF_NS.length - 1} step={1} onChange={setNi} display={(i) => String(CF_NS[i])} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of achieved coverage across calibration sets">
        <Axis scale={y} orient="left" at={L} gridTo={R} format={(v) => `${Math.round(v * 100)}%`} label="share of reruns" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]} format={(v) => `${Math.round(v * 100)}%`} label="coverage on future weeks" />
        {counts.map((c, i) => (
          <rect key={i} x={x(start + i * bw) + 0.5} width={x(bw) - x(0) - 1} y={y(c / CF_REPS)} height={B - y(c / CF_REPS)} fill="var(--series-1)" />
        ))}
        <line x1={x(1 - CF.alpha)} x2={x(1 - CF.alpha)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" strokeWidth={1.5} />
        <line x1={x(pois)} x2={x(pois)} y1={10} y2={B} stroke="var(--series-2)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Conformal intervals" shape="bar" />
        <Key color="var(--ink)" label="Target 80%" shape="line" />
        <Key color="var(--series-2)" label="Poisson interval" shape="line" />
      </div>
    </Panel>
  );
}

// ---------- fc-promotions ----------

const money = (v: number) => `${v < 0 ? "−" : "+"}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;

export function PromoShape() {
  const [depth, setDepth] = useState(PROMO.depth);
  const [pull, setPull] = useState(PROMO.pull);
  const [dipWeeks, setDipWeeks] = useState(PROMO.dipWeeks);
  const e = promoEffect(depth, pull, dipWeeks);
  const x = linear([-0.5, e.weeks.length - 0.5], [L, R]);
  const y = linear([0, Math.max(300, ...e.weeks)], [B, 10]);
  const label = (i: number) => (i === 2 ? "promo" : i < 2 ? `${i - 2}` : `+${i - 2}`);
  return (
    <Panel
      title="Deck stain on promotion: the spike, the dip, and what is left"
      footer={
        <>
          Gross lift <span className="font-semibold tabular" data-testid="pr-lift">{Math.round(e.lift)}</span> tins; dip{" "}
          <span className="font-semibold tabular" data-testid="pr-dip">{Math.round(e.dip)}</span>; net extra{" "}
          <span className="font-semibold tabular" data-testid="pr-net">{Math.round(e.net)}</span>. Promo margin ₹{Math.round(e.promoMargin)} a tin, so profit against no promo:{" "}
          <span className="font-semibold tabular" data-testid="pr-profit">{money(e.profit)}</span>.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider id="pr-depth" label="Discount" value={depth} min={0.05} max={0.4} step={0.05} onChange={(v) => setDepth(Number(v.toFixed(2)))} display={(v) => `${Math.round(v * 100)}%`} />
        <Slider id="pr-pull" label="Share of lift pulled forward" value={pull} min={0} max={0.6} step={0.1} onChange={(v) => setPull(Number(v.toFixed(1)))} display={(v) => `${Math.round(v * 100)}%`} />
        <Slider id="pr-dip" label="Dip lasts (weeks)" value={dipWeeks} min={1} max={6} step={1} onChange={setDipWeeks} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Weekly sales around a promotion">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="tins a week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={e.weeks.map((_, i) => i)} format={label} label="week" />
        {e.weeks.map((v, i) => {
          const w = x(0.7) - x(0);
          const base = Math.min(v, PROMO.base);
          return (
            <g key={i}>
              <rect x={x(i) - w / 2} width={w} y={y(base)} height={B - y(base)} fill="var(--seq-100)" />
              {v > PROMO.base && <rect x={x(i) - w / 2} width={w} y={y(v)} height={y(PROMO.base) - y(v)} fill="var(--series-1)" />}
              {v < PROMO.base && <rect x={x(i) - w / 2} width={w} y={y(PROMO.base)} height={y(v) - y(PROMO.base)} fill="none" stroke="var(--critical)" strokeDasharray="3 2" />}
            </g>
          );
        })}
        <line x1={L} x2={R} y1={y(PROMO.base)} y2={y(PROMO.base)} stroke="var(--ink)" strokeDasharray="4 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-100)" label="Baseline sales" shape="bar" />
        <Key color="var(--series-1)" label="Promo lift" shape="bar" />
        <Key color="var(--critical)" label="Dip: sales pulled forward" shape="line" />
      </div>
    </Panel>
  );
}

const MODEL_NAMES: Record<PromoModel, string> = { history: "History average", depth: "Promo depth", dip: "Depth + last 3 weeks' promos" };

export function promoExample() {
  const skus = promoSkus();
  const i = skus.findIndex((s) => s.depth.slice(PS.train + 2, PS.weeks - 8).some((d) => d >= 0.25));
  return { sku: skus[i], forecasts: Object.fromEntries((["history", "depth", "dip"] as PromoModel[]).map((m) => [m, promoForecast(skus[i], m)])) as Record<PromoModel, number[]> };
}

export function PromoStudy() {
  const [model, setModel] = useState<PromoModel>("depth");
  const study = useMemo(() => promoStudy(), []);
  const ex = useMemo(() => promoExample(), []);
  const actual = ex.sku.y.slice(PS.train);
  const f = ex.forecasts[model];
  const n = actual.length;
  const x = linear([-0.5, n - 0.5], [L, R]);
  const y = linear([0, Math.max(...actual, ...f) * 1.1], [B, 10]);
  return (
    <Panel
      title={`${PS.skus} SKUs, ${PS.promos} promos each over two years: forecast the last ${n} weeks, with the promo calendar known in advance`}
      footer={
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-ink-2">
                <th className="py-1 pr-3 font-medium">Model</th>
                <th className="py-1 pr-3 font-medium">Promo-week WAPE</th>
                <th className="py-1 pr-3 font-medium">Bias, 3 weeks after</th>
                <th className="py-1 font-medium">Bias, other weeks</th>
              </tr>
            </thead>
            <tbody>
              {study.map((s) => (
                <tr key={s.model} className="border-t border-line">
                  <td className="py-1 pr-3">{MODEL_NAMES[s.model]}</td>
                  <td className="py-1 pr-3" data-testid={`ps-promo-${s.model}`}>{pct(s.promoWape)}</td>
                  <td className="py-1 pr-3" data-testid={`ps-post-${s.model}`}>{s.postBias > 0 ? "+" : ""}{pct(s.postBias)}</td>
                  <td className="py-1" data-testid={`ps-plain-${s.model}`}>{s.plainBias > 0 ? "+" : ""}{pct(s.plainBias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <Radios label="Forecast model" value={model} options={(["history", "depth", "dip"] as PromoModel[]).map((id) => ({ id, name: MODEL_NAMES[id] }))} onChange={setModel} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="One SKU's test weeks with the chosen model's forecast">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="units a week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={ticks(0, n - 1)} format={(v) => String(PS.train + v + 1)} label="week" />
        {actual.map((v, i) => {
          const w = x(0.7) - x(0);
          const t = PS.train + i;
          const promo = ex.sku.depth[t] > 0;
          return <rect key={i} x={x(i) - w / 2} width={w} y={y(v)} height={B - y(v)} fill={promo ? "var(--series-1)" : "var(--seq-100)"} />;
        })}
        <path d={path(f.map((v, i) => [x(i), y(Math.max(v, 0))]))} fill="none" stroke="var(--series-2)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-100)" label="Actual sales" shape="bar" />
        <Key color="var(--series-1)" label="Promo week" shape="bar" />
        <Key color="var(--series-2)" label="Forecast" shape="line" />
      </div>
    </Panel>
  );
}

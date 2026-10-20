"use client";

import { useMemo, useState } from "react";
import { avg, corr, essChains, MMM_TRUTH, mmmOLS, mmmSample, mmmStudy, mmmWorld, quantile, rhat, share, type MMMPrior } from "@/lib/sim/mcmc";
import { Axis, Key, linear, Panel } from "./kit";

const VW = 460;
const H = 230;
const L = 44;
const B = H - 32;
const R = VW - 12;

/** The region whose least-squares fit says TV loses money. */
export const MMM_SEED = 7;

export function SpendTogether() {
  const d = useMemo(() => mmmWorld(MMM_SEED), []);
  const x = linear([1, 52], [L, R]);
  const y = linear([0, 12], [B, 10]);
  const line = (v: number[]) => v.map((s, i) => `${x(i + 1).toFixed(1)},${y(s).toFixed(1)}`).join(" ");
  return (
    <Panel
      title="One region's weekly media spend: TV and search follow the same plan"
      footer={
        <>
          Correlation between TV and search spend: <span className="font-semibold tabular" data-testid="mm-corr">{corr(d.tv, d.search).toFixed(2)}</span>. Both peak in the Diwali
          weeks, so whenever sales rise, both channels were up.
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="TV and search spend by week">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="₹ lakh / week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[1, 13, 26, 39, 52]} label="week" />
        <polyline points={line(d.tv)} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <polyline points={line(d.search)} fill="none" stroke="var(--series-2)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="TV spend" shape="line" />
        <Key color="var(--series-2)" label="Search spend" shape="line" />
      </div>
    </Panel>
  );
}

const PRIORS: { id: MMMPrior; name: string }[] = [
  { id: "flat", name: "Flat priors" },
  { id: "positive", name: "Positive priors" },
  { id: "lift", name: "Positive + TV lift test" },
];

export function MMMBridge() {
  const d = useMemo(() => mmmWorld(MMM_SEED), []);
  const ols = useMemo(() => mmmOLS(d), [d]);
  const [prior, setPrior] = useState<MMMPrior>("flat");
  const fit = useMemo(() => mmmSample(d, prior, MMM_SEED), [d, prior]);
  const tvChains = fit.chains.map((c) => c.tv);
  const S = 300;
  const px = linear([-4, 5], [36, S - 10]);
  const py = linear([-2, 10], [S - 30, 10]);
  const every = Math.ceil(fit.tv.length / 1500);
  // Histogram of the TV ROI.
  const lo = -4;
  const hi = 5;
  const bins = 45;
  const bw = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const v of fit.tv) {
    const k = Math.floor((v - lo) / bw);
    if (k >= 0 && k < bins) counts[k]++;
  }
  const hx = linear([lo, hi], [L, R]);
  const hy = linear([0, Math.max(...counts) * 1.1], [B, 10]);
  return (
    <Panel
      title="Posterior draws for the two ROIs, from four Metropolis chains"
      footer={
        <>
          TV ROI: mean <span className="font-semibold tabular" data-testid="mm-tv">{avg(fit.tv).toFixed(2)}</span>, 90% interval{" "}
          <span className="font-semibold tabular" data-testid="mm-tv-lo">{quantile(fit.tv, 0.05).toFixed(2)}</span> to{" "}
          <span className="font-semibold tabular" data-testid="mm-tv-hi">{quantile(fit.tv, 0.95).toFixed(2)}</span>; P(TV pays back, ROI above 1){" "}
          <span className="font-semibold tabular" data-testid="mm-p1">{(share(fit.tv, (v) => v > 1) * 100).toFixed(1)}%</span>; P(TV ROI below 0){" "}
          <span className="font-semibold tabular" data-testid="mm-p0">{(share(fit.tv, (v) => v < 0) * 100).toFixed(1)}%</span>. Search ROI: mean{" "}
          <span className="font-semibold tabular" data-testid="mm-search">{avg(fit.search).toFixed(2)}</span>. Diagnostics: R-hat{" "}
          <span className="font-semibold tabular" data-testid="mm-rhat">{rhat(tvChains).toFixed(3)}</span>, effective draws{" "}
          <span className="font-semibold tabular" data-testid="mm-ess">{Math.round(essChains(tvChains)).toLocaleString("en-IN")}</span> of {fit.tv.length.toLocaleString("en-IN")}. Least
          squares said TV {ols[0].toFixed(2)}, search {ols[1].toFixed(2)}; the planted truth is {MMM_TRUTH.tv} and {MMM_TRUTH.search}.
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Priors">
        {PRIORS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={prior === p.id}
            onClick={() => setPrior(p.id)}
            className={prior === p.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center">
        <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-auto w-full max-w-[340px]" role="img" aria-label="Scatter of posterior draws: TV ROI against search ROI">
          {prior !== "flat" && <rect x={px(0)} y={py(10)} width={px(5) - px(0)} height={py(0) - py(10)} fill="var(--accent-wash)" />}
          <line x1={px(-4)} x2={px(5)} y1={py(0)} y2={py(0)} stroke="var(--axis)" />
          <line x1={px(0)} x2={px(0)} y1={py(-2)} y2={py(10)} stroke="var(--axis)" />
          {[-4, -2, 0, 2, 4].map((v) => (
            <text key={v} x={px(v)} y={S - 16} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {v}
            </text>
          ))}
          {[0, 2, 4, 6, 8, 10].map((v) => (
            <text key={v} x={30} y={py(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {v}
            </text>
          ))}
          <defs>
            <clipPath id="mm-clip">
              <rect x={px(-4)} y={py(10)} width={px(5) - px(-4)} height={py(-2) - py(10)} />
            </clipPath>
          </defs>
          <g clipPath="url(#mm-clip)">
            {fit.tv.map((t, i) => (i % every === 0 ? <circle key={i} cx={px(t)} cy={py(fit.search[i])} r={1.6} fill="var(--series-1)" opacity={0.35} /> : null))}
          </g>
          <circle cx={px(ols[0])} cy={py(ols[1])} r={5} fill="none" stroke="var(--series-2)" strokeWidth={2} />
          <path d={`M${px(MMM_TRUTH.tv) - 6},${py(MMM_TRUTH.search)}h12M${px(MMM_TRUTH.tv)},${py(MMM_TRUTH.search) - 6}v12`} stroke="var(--ink)" strokeWidth={2} />
          <text x={(px(-4) + px(5)) / 2} y={S - 2} textAnchor="middle" fontSize={11} fill="var(--muted)">
            TV ROI
          </text>
          <text x={10} y={S / 2} textAnchor="middle" fontSize={11} fill="var(--muted)" transform={`rotate(-90 10 ${S / 2})`}>
            search ROI
          </text>
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Histogram of TV ROI draws">
          <Axis scale={hy} orient="left" at={L} gridTo={R} format={() => ""} label="draws" />
          <Axis scale={hx} orient="bottom" at={B} label="TV ROI (₹ of sales per ₹ spent)" />
          {counts.map((c, k) => (
            <rect
              key={k}
              x={hx(lo + k * bw) + 0.5}
              y={hy(c)}
              width={Math.max(hx(bw) - hx(0) - 1, 0)}
              height={B - hy(c)}
              fill={lo + (k + 0.5) * bw > 1 ? "var(--series-3)" : "var(--seq-250)"}
            />
          ))}
          <line x1={hx(1)} x2={hx(1)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Posterior draw" />
        <Key color="var(--series-2)" label="Least-squares answer" />
        <Key color="var(--ink)" label="Planted truth (+)" shape="line" />
        <Key color="var(--series-3)" label="TV draws that pay back (ROI above 1)" shape="bar" />
      </div>
    </Panel>
  );
}

export const MS_WORLDS = 200;
export const MS_SEED = 100;

export function MMMStudy() {
  const res = useMemo(() => mmmStudy(MS_WORLDS, MS_SEED), []);
  const rows = [
    { id: "ols", name: "Least squares", v: res.ols },
    { id: "positive", name: "Positive priors", v: res.positive },
    { id: "lift", name: "Positive + lift test", v: res.lift },
  ] as const;
  const x = linear([0, 1.6], [150, R - 40]);
  return (
    <Panel
      title={`${MS_WORLDS} regions, same planted truth: how far off is the TV ROI?`}
      footer={
        <>
          Typical error in the TV ROI (root mean square): least squares <span className="font-semibold tabular" data-testid="ms-ols">{res.ols.rmse.toFixed(2)}</span>, positive priors{" "}
          <span className="font-semibold tabular" data-testid="ms-positive">{res.positive.rmse.toFixed(2)}</span>, with the lift test{" "}
          <span className="font-semibold tabular" data-testid="ms-lift">{res.lift.rmse.toFixed(2)}</span>. Least squares called TV a money-loser (ROI below 0) in{" "}
          <span className="font-semibold tabular" data-testid="ms-neg">{(res.ols.negative * 100).toFixed(1)}%</span> of regions.
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} 130`} className="h-auto w-full" role="img" aria-label="Root mean square error of the TV ROI for each method">
        {rows.map((r, k) => (
          <g key={r.id}>
            <text x={140} y={28 + k * 36} textAnchor="end" fontSize={12} fill="var(--ink-2)">
              {r.name}
            </text>
            <rect x={150} y={14 + k * 36} width={x(r.v.rmse) - 150} height={20} rx={3} fill={r.id === "ols" ? "var(--series-2)" : "var(--series-3)"} />
            <text x={x(r.v.rmse) + 6} y={28 + k * 36} fontSize={12} fill="var(--ink)" className="tabular">
              {r.v.rmse.toFixed(2)}
            </text>
          </g>
        ))}
      </svg>
    </Panel>
  );
}

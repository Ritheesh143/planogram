"use client";

import { useMemo, useState } from "react";
import {
  gridInterval,
  gridMean,
  pgData,
  PG_GRID,
  poissonGridPosterior,
  presetPrior,
  relativeLikelihood,
  repeatWorlds,
  type PriorPreset,
} from "@/lib/sim/bayesSim";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 120;
const L = 44;
const B = H - 22;

const PRESETS: { id: PriorPreset; name: string }[] = [
  { id: "flat", name: "Flat: no opinion" },
  { id: "hunch", name: "Manager's hunch: about 3 a day" },
  { id: "skeptical", name: "Skeptic: about 1 a day" },
];

function Bars({ values, color, label, mark }: { values: number[]; color: string; label: string; mark?: number }) {
  const x = linear([0, 6.1], [L, VW - 10]);
  const top = Math.max(...values);
  const y = linear([0, top * 1.08], [B, 8]);
  const w = x(0.1) - x(0) - 1;
  return (
    <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <Axis scale={x} orient="bottom" at={B} tickValues={[0, 1, 2, 3, 4, 5, 6]} />
      {values.map((v, i) => (
        <rect key={i} x={x(PG_GRID[i]) - w / 2} y={y(v)} width={w} height={B - y(v)} fill={color} />
      ))}
      {mark !== undefined && <line x1={x(mark)} x2={x(mark)} y1={8} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />}
      <text x={L} y={14} fontSize={11} fill="var(--ink-2)">
        {label}
      </text>
    </svg>
  );
}

/** Prior bars × likelihood bars, divided by their total, give the posterior bars. */
export function PosteriorGrid() {
  const [preset, setPreset] = useState<PriorPreset>("flat");
  const [extra, setExtra] = useState(0);
  const data = pgData(extra);
  const prior = presetPrior(preset);
  const like = relativeLikelihood(PG_GRID, data);
  const post = poissonGridPosterior(PG_GRID, prior, data);
  const mean = gridMean(PG_GRID, post);
  const [lo, hi] = gridInterval(PG_GRID, post, 0.9);
  const dataMean = data.reduce((a, b) => a + b, 0) / data.length;

  return (
    <Panel
      title="Sixty hypotheses for the drill's daily rate λ, from 0.1 to 6. Belief before, evidence, belief after."
      footer={
        <>
          After {data.length} days (average {fmt(dataMean, 2)} a day): posterior mean{" "}
          <span className="font-semibold tabular" data-testid="pg-mean">
            {fmt(mean, 2)}
          </span>{" "}
          drills a day, and 90% of the belief lies between{" "}
          <span className="font-semibold tabular" data-testid="pg-interval">
            {fmt(lo, 1)} and {fmt(hi, 1)}
          </span>
          .
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Prior">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={preset === p.id}
            onClick={() => setPreset(p.id)}
            className={preset === p.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Slider id="pg-extra" label="Extra days of sales after the first three" value={extra} min={0} max={27} step={1} onChange={setExtra} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-xs tabular" aria-label="Daily sales">
        {data.map((k, i) => (
          <span key={i} className={`rounded px-1.5 py-0.5 ${i < 3 ? "bg-accent text-white" : "bg-surface-2 text-ink"}`}>
            {k}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-1">
        <Bars values={prior} color="var(--series-1)" label="Prior: belief in each λ before the data" />
        <div className="text-center text-lg text-muted" aria-hidden>
          ×
        </div>
        <Bars values={like} color="var(--series-2)" label="Likelihood: how probable the sales are under each λ (scaled)" />
        <div className="text-center text-lg text-muted" aria-hidden>
          = (then divide by the total)
        </div>
        <Bars values={post} color="var(--series-3)" label="Posterior: belief in each λ after the data" mark={mean} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Prior" shape="bar" />
        <Key color="var(--series-2)" label="Likelihood" shape="bar" />
        <Key color="var(--series-3)" label="Posterior" shape="bar" />
        <Key color="var(--ink)" label="Posterior mean" shape="line" />
        <span className="text-xs text-ink-2">λ, drills per day, on every axis</span>
      </div>
    </Panel>
  );
}

const ANALYSTS = [
  { id: "matched" as const, name: "Prior matches the chain" },
  { id: "flat" as const, name: "Flat prior" },
  { id: "wrong" as const, name: "Confident and wrong: about 4 a day" },
];

/** Repeat the world 1,000 times: does the truth land inside the 90% credible interval 90% of the time? */
export function WorldRepeater() {
  const [analyst, setAnalyst] = useState<"matched" | "flat" | "wrong">("matched");
  const [days, setDays] = useState(3);
  const worlds = useMemo(() => repeatWorlds(1000, analyst, days), [analyst, days]);
  const covered = worlds.filter((w) => w.covers).length;
  const shown = worlds.slice(0, 40);
  const x = linear([0, 6], [L, VW - 10]);
  const rowH = 6;
  const Hs = shown.length * rowH + 40;
  return (
    <Panel
      title="1,000 stores, each with its own true rate drawn from the chain's real spread. Each gets a 90% credible interval from its own sales."
      footer={
        <>
          <span className="font-semibold tabular" data-testid="pg-coverage">
            {covered} of 1,000
          </span>{" "}
          intervals contain their store&apos;s true rate.
          {analyst === "wrong"
            ? " A confident, wrong prior drags every interval toward 4, and more data only slowly rescues it."
            : " When the prior describes how rates really vary across stores, “90% sure” means right 90% of the time."}
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Analyst's prior">
        {ANALYSTS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={analyst === a.id}
            onClick={() => setAnalyst(a.id)}
            className={analyst === a.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {a.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Days of sales per store">
        {[3, 30].map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={days === d}
            onClick={() => setDays(d)}
            className={days === d ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {d} days per store
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${Hs}`} className="mt-3 h-auto w-full" role="img" aria-label={`First 40 of 1,000 credible intervals; ${covered} of 1,000 contain the truth`}>
        <Axis scale={x} orient="bottom" at={Hs - 24} tickValues={[0, 1, 2, 3, 4, 5, 6]} label="drills per day" />
        {shown.map((w, i) => {
          const yy = 6 + i * rowH;
          const color = w.covers ? "var(--series-1)" : "var(--critical)";
          return (
            <g key={i}>
              <line x1={x(w.lo)} x2={x(Math.min(6, w.hi))} y1={yy} y2={yy} stroke={color} strokeWidth={2} />
              <circle cx={x(Math.min(6, w.truth))} cy={yy} r={2} fill="var(--ink)" />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Interval contains the store's true rate" shape="line" />
        <Key color="var(--critical)" label="✗ Interval misses it" shape="line" />
        <Key color="var(--ink)" label="True rate" />
      </div>
    </Panel>
  );
}

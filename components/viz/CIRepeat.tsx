"use client";

import { useMemo, useRef, useState } from "react";
import { runMany } from "@/lib/sim/experiments";
import { mulberry32 } from "@/lib/sim/rng";
import { Axis, Key, linear, Panel, Slider, Tip } from "./kit";

const TRUE_LIFT = 5; // percent
const NOISE_SD = 8; // store-to-store spread of measured lift, in points
const N = 100;
const VW = 640;
const ROW = 4.2;
const TOP = 16;
const LEFT = 40;
const RIGHT = 620;
const VH = TOP + N * ROW + 46;

const levels = [0.8, 0.9, 0.95, 0.99];

/** Re-run the same endcap experiment 100 times and watch which intervals catch the truth. */
export function CIRepeat() {
  const [stores, setStores] = useState(20);
  const [levelIdx, setLevelIdx] = useState(2);
  const [seed, setSeed] = useState(7);
  const [tally, setTally] = useState({ covered: 0, total: 0 });
  const [useZ, setUseZ] = useState(false);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const level = levels[levelIdx];

  const intervals = useMemo(
    () => runMany(mulberry32(seed), N, { stores, trueLift: TRUE_LIFT, noiseSd: NOISE_SD, level, useZ }),
    [seed, stores, level, useZ],
  );
  const covered = intervals.filter((iv) => iv.covers).length;

  const x = linear([-10, 20], [LEFT, RIGHT]);
  const clampX = (v: number) => Math.max(LEFT, Math.min(RIGHT, x(v)));

  const rerun = () => {
    setTally((t) => ({ covered: t.covered + covered, total: t.total + N }));
    setSeed((s) => s + 1);
  };

  const runThousand = () => {
    const rng = mulberry32(seed * 7919 + 13);
    const more = runMany(rng, 1000, { stores, trueLift: TRUE_LIFT, noiseSd: NOISE_SD, level, useZ });
    setTally((t) => ({ covered: t.covered + more.filter((m) => m.covers).length, total: t.total + 1000 }));
    setSeed((s) => s + 1);
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = VW / rect.width;
    const sy = (e.clientY - rect.top) * k;
    const i = Math.floor((sy - TOP) / ROW);
    if (i < 0 || i >= N) return setHover(null);
    const iv = intervals[i];
    const box = wrap.current!.getBoundingClientRect();
    setHover({ i, x: rect.left - box.left + clampX(iv.estimate) / k, y: rect.top - box.top + (TOP + i * ROW) / k });
  };

  return (
    <Panel
      title={`100 repeats of the same endcap experiment. The true lift is ${TRUE_LIFT}% (in real life you never get to see this line).`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="ci-stores" label="Stores per experiment" value={stores} min={5} max={80} step={1} onChange={(v) => { setStores(v); setTally({ covered: 0, total: 0 }); }} />
        <Slider
          id="ci-level"
          label="Confidence level"
          value={levelIdx}
          min={0}
          max={levels.length - 1}
          step={1}
          onChange={(v) => { setLevelIdx(v); setTally({ covered: 0, total: 0 }); }}
          display={(i) => `${levels[i] * 100}%`}
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={useZ}
          onChange={(e) => {
            setUseZ(e.target.checked);
            setTally({ covered: 0, total: 0 });
          }}
        />
        Use the normal multiplier (1.96 for 95%) instead of the t multiplier
      </label>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <Key color="var(--series-1)" label="Interval contains the true lift" shape="line" />
        <Key color="var(--critical)" label="✗ Interval misses it" shape="line" />
        <Key color="var(--ink)" label="True lift" shape="line" />
      </div>

      <div ref={wrap} className="relative mt-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${covered} of ${N} intervals contain the true lift`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <Axis scale={x} orient="bottom" at={TOP + N * ROW + 6} format={(v) => `${v}%`} label="Measured sales lift from the endcap" gridTo={TOP - 6} />
          {intervals.map((iv, i) => {
            const y = TOP + i * ROW + ROW / 2;
            const color = iv.covers ? "var(--series-1)" : "var(--critical)";
            return (
              <g key={i} opacity={hover && hover.i !== i ? 0.55 : 1}>
                <line x1={clampX(iv.lo)} x2={clampX(iv.hi)} y1={y} y2={y} stroke={color} strokeWidth={hover?.i === i ? 2.5 : 1.6} strokeLinecap="round" />
                <circle cx={clampX(iv.estimate)} cy={y} r={1.6} fill={color} />
              </g>
            );
          })}
          <line x1={x(TRUE_LIFT)} x2={x(TRUE_LIFT)} y1={TOP - 8} y2={TOP + N * ROW + 4} stroke="var(--ink)" strokeWidth={1.5} />
          <text x={x(TRUE_LIFT) + 5} y={TOP - 2} fontSize={11} fill="var(--ink)">
            true lift {TRUE_LIFT}%
          </text>
          {/* The first row is the experiment you would actually run. */}
          <text x={RIGHT} y={TOP + ROW} textAnchor="end" fontSize={10} fill="var(--ink-2)">
            ← your one real experiment
          </text>
        </svg>
        {hover && (
          <Tip x={hover.x} y={hover.y}>
            Experiment {hover.i + 1}: estimate {intervals[hover.i].estimate.toFixed(1)}%, interval [
            {intervals[hover.i].lo.toFixed(1)}%, {intervals[hover.i].hi.toFixed(1)}%]{" "}
            {intervals[hover.i].covers ? "contains" : "✗ misses"} the truth
          </Tip>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-2 p-3" data-testid="ci-covered">
          <div className="text-xs text-ink-2">This batch</div>
          <div className="text-xl font-semibold tabular">
            {covered} of {N} caught the truth
          </div>
        </div>
        <div className="rounded-lg bg-surface-2 p-3">
          <div className="text-xs text-ink-2">Running total, including this batch</div>
          <div className="text-xl font-semibold tabular" data-testid="ci-running">
            {(((tally.covered + covered) / (tally.total + N)) * 100).toFixed(1)}% of{" "}
            {(tally.total + N).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={rerun} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white">
          Run 100 new experiments
        </button>
        <button type="button" onClick={runThousand} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent">
          Run 1,000 more and just count
        </button>
      </div>
    </Panel>
  );
}

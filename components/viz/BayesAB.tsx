"use client";

import { useMemo, useState } from "react";
import { betaPdf } from "@/lib/sim/bayes";
import { AB, abDraws, abSummary, peekingStudy, peekPaths, probBBeatsA } from "@/lib/sim/mcmc";
import { Axis, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 220;
const L = 44;
const B = H - 32;
const R = VW - 12;

export const AB_DRAWS = 4000;
export const AB_SEED = 1;

const pp = (v: number, d = 2) => `${(v * 100).toFixed(d)}`;

export function ABTest() {
  const [visitors, setVisitors] = useState(AB.visitors);
  const [buysA, setBuysA] = useState(AB.buysA);
  const [buysB, setBuysB] = useState(AB.buysB);
  const kA = Math.min(buysA, visitors);
  const kB = Math.min(buysB, visitors);
  const d = useMemo(() => abDraws(kA, kB, visitors, AB_DRAWS, AB_SEED), [kA, kB, visitors]);
  const s = abSummary(d.a, d.b);
  const exact = probBBeatsA(1 + kA, 1 + visitors - kA, 1 + kB, 1 + visitors - kB);
  // Posterior curves on a range that fits both.
  const mA = (1 + kA) / (2 + visitors);
  const mB = (1 + kB) / (2 + visitors);
  const sdv = (m: number) => Math.sqrt((m * (1 - m)) / (3 + visitors));
  const lo = Math.max(0, Math.min(mA - 4.5 * sdv(mA), mB - 4.5 * sdv(mB)));
  const hi = Math.min(1, Math.max(mA + 4.5 * sdv(mA), mB + 4.5 * sdv(mB)));
  const xs = Array.from({ length: 161 }, (_, i) => lo + ((hi - lo) * i) / 160);
  const fa = xs.map((x) => betaPdf(x, 1 + kA, 1 + visitors - kA));
  const fb = xs.map((x) => betaPdf(x, 1 + kB, 1 + visitors - kB));
  const top = Math.max(...fa, ...fb) * 1.08;
  const x = linear([lo * 100, hi * 100], [L, R]);
  const y = linear([0, top], [B, 10]);
  const line = (f: number[]) => xs.map((v, i) => `${x(v * 100).toFixed(1)},${y(f[i]).toFixed(1)}`).join(" ");
  // Histogram of B's relative lift.
  const lifts = d.b.map((b, i) => b / d.a[i] - 1);
  const lx0 = -0.6;
  const lx1 = 1.6;
  const bins = 44;
  const bw = (lx1 - lx0) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const v of lifts) {
    const k = Math.floor((v - lx0) / bw);
    if (k >= 0 && k < bins) counts[k]++;
  }
  const lxs = linear([lx0 * 100, lx1 * 100], [L, R]);
  const lys = linear([0, Math.max(...counts) * 1.1 || 1], [B, 10]);
  return (
    <Panel
      title="The endcap test: usual display (A) vs the new one (B), flat priors"
      footer={
        <>
          Counting {AB_DRAWS.toLocaleString("en-IN")} pairs of draws: B is better in <span className="font-semibold tabular" data-testid="ab-p">{(s.pBetter * 100).toFixed(1)}%</span>{" "}
          of them (exact, by thin bars: <span className="font-semibold tabular" data-testid="ab-exact">{(exact * 100).toFixed(1)}%</span>). Expected loss if you ship B:{" "}
          <span className="font-semibold tabular" data-testid="ab-loss-b">{pp(s.lossB, 3)}</span> percentage points; if you keep A:{" "}
          <span className="font-semibold tabular" data-testid="ab-loss-a">{pp(s.lossA)}</span>. B&apos;s lift over A: median {pp(s.liftMid, 0)}%, 90% interval{" "}
          <span className="font-semibold tabular" data-testid="ab-lift-lo">{pp(s.liftLo, 1)}%</span> to{" "}
          <span className="font-semibold tabular" data-testid="ab-lift-hi">{pp(s.liftHi, 1)}%</span>.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider id="ab-visitors" label="Visitors per display" value={visitors} min={200} max={5000} step={100} onChange={setVisitors} display={(v) => v.toLocaleString("en-IN")} />
        <Slider id="ab-buys-a" label="Bought at A" value={kA} min={0} max={Math.min(400, visitors)} step={1} onChange={setBuysA} display={(v) => `${v} (${((v / visitors) * 100).toFixed(1)}%)`} />
        <Slider id="ab-buys-b" label="Bought at B" value={kB} min={0} max={Math.min(400, visitors)} step={1} onChange={setBuysB} display={(v) => `${v} (${((v / visitors) * 100).toFixed(1)}%)`} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Posterior curves for the two conversion rates">
          <Axis scale={y} orient="left" at={L} gridTo={R} format={() => ""} label="belief" />
          <Axis scale={x} orient="bottom" at={B} format={(v) => `${v.toFixed(1)}%`} label="conversion rate" />
          <polyline points={line(fa)} fill="none" stroke="var(--series-1)" strokeWidth={2} />
          <polyline points={line(fb)} fill="none" stroke="var(--series-2)" strokeWidth={2} />
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Histogram of B's relative lift over A">
          <Axis scale={lys} orient="left" at={L} gridTo={R} format={() => ""} label="draws" />
          <Axis scale={lxs} orient="bottom" at={B} format={(v) => `${v.toFixed(0)}%`} label="B's lift over A" />
          {counts.map((c, k) => (
            <rect
              key={k}
              x={lxs((lx0 + k * bw) * 100) + 0.5}
              y={lys(c)}
              width={Math.max(lxs(bw * 100) - lxs(0) - 1, 0)}
              height={B - lys(c)}
              fill={lx0 + (k + 0.5) * bw < 0 ? "var(--series-1)" : "var(--series-2)"}
            />
          ))}
          <line x1={lxs(0)} x2={lxs(0)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="A: usual display (and draws where A wins)" shape="line" />
        <Key color="var(--series-2)" label="B: new display (and draws where B wins)" shape="line" />
      </div>
    </Panel>
  );
}

export const PEEK_LOOKS = [1, 4, 28];
export const PEEK_TESTS = 2000;
export const PEEK_SEED = 9;

export function PeekingStudy() {
  const rates = useMemo(() => PEEK_LOOKS.map((l) => peekingStudy(l, PEEK_TESTS, PEEK_SEED)), []);
  const paths = useMemo(() => peekPaths(30, 3), []);
  const [looks, setLooks] = useState(28);
  const x = linear([1, 28], [L, R]);
  const y = linear([0, 1], [B, 10]);
  const days = new Set(Array.from({ length: looks }, (_, i) => Math.round(((i + 1) * 28) / looks)));
  const crosses = (p: number[]) => p.some((v, i) => days.has(i + 1) && v > 0.95);
  const idx = PEEK_LOOKS.indexOf(looks);
  return (
    <Panel
      title="A/A tests: both displays truly convert 4%. Ship B the first time P(B > A) passes 95%"
      footer={
        <>
          Across {PEEK_TESTS.toLocaleString("en-IN")} simulated A/A tests, the share that shipped a winner that doesn&apos;t exist: one look at day 28{" "}
          <span className="font-semibold tabular" data-testid="pk-1">{(rates[0] * 100).toFixed(1)}%</span>, weekly looks{" "}
          <span className="font-semibold tabular" data-testid="pk-4">{(rates[1] * 100).toFixed(1)}%</span>, daily looks{" "}
          <span className="font-semibold tabular" data-testid="pk-28">{(rates[2] * 100).toFixed(1)}%</span>. In the 30 tests drawn here,{" "}
          <span className="font-semibold tabular" data-testid="pk-drawn">{paths.filter(crosses).length}</span> would have shipped B with {idx === 0 ? "one look" : idx === 1 ? "weekly looks" : "daily looks"}.
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How often you look">
        {PEEK_LOOKS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={looks === l}
            onClick={() => setLooks(l)}
            className={looks === l ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {l === 1 ? "Look once, at day 28" : l === 4 ? "Look weekly" : "Look daily"}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="P(B beats A) day by day for 30 A/A tests">
        <Axis scale={y} orient="left" at={L} gridTo={R} format={(v) => `${Math.round(v * 100)}%`} label="P(B > A)" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[1, 7, 14, 21, 28]} label="day" />
        <line x1={L} x2={R} y1={y(0.95)} y2={y(0.95)} stroke="var(--critical)" strokeDasharray="4 3" />
        {paths.map((p, j) => (
          <polyline
            key={j}
            points={p.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={crosses(p) ? "var(--series-2)" : "var(--seq-250)"}
            strokeWidth={crosses(p) ? 1.6 : 1}
            opacity={crosses(p) ? 1 : 0.7}
          />
        ))}
        {[...days].map((dd) => (
          <line key={dd} x1={x(dd)} x2={x(dd)} y1={B} y2={B - 5} stroke="var(--ink)" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-250)" label="A/A test, never crossed at a look" shape="line" />
        <Key color="var(--series-2)" label="Crossed 95% at a look: ships a fake winner" shape="line" />
        <Key color="var(--critical)" label="95% line" shape="line" />
      </div>
    </Panel>
  );
}

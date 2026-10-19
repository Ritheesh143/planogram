"use client";

import { useMemo, useRef, useState } from "react";
import { poissonLikelihood, poissonLogLikelihood, poissonPmf } from "@/lib/sim/prob";
import { mulberry32, poisson } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider, Tip } from "./kit";

const KMAX = 10;

/** Plain decimals for axis ticks; scientific notation only for genuinely tiny values. */
function smallNumber(v: number): string {
  if (v === 0) return "0";
  if (Math.abs(v) >= 0.001) return String(Number(v.toPrecision(2)));
  return v.toExponential(0);
}
const LMAX = 8;
const VW = 460;

/**
 * Two views of the same Poisson model. Left: fix λ, see how probable each possible
 * day's sales are. Right: fix the observed sales, see how well each λ explains them.
 */
export function LikelihoodDial({ initialData = [0, 2, 1] }: { initialData?: number[] }) {
  const [data, setData] = useState(initialData);
  const [lambda, setLambda] = useState(3);
  const [useLog, setUseLog] = useState(false);
  const [hover, setHover] = useState<{ l: number; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const mle = data.reduce((a, b) => a + b, 0) / data.length;
  const probs = data.map((k) => poissonPmf(k, lambda));
  const L = poissonLikelihood(data, lambda);

  const grid = useMemo(() => Array.from({ length: 321 }, (_, i) => 0.025 + (i * (LMAX - 0.025)) / 320), []);
  const curve = useMemo(
    () => grid.map((l) => (useLog ? poissonLogLikelihood(data, l) : poissonLikelihood(data, l))),
    [grid, data, useLog],
  );
  // Area under the likelihood curve, by summing thin bars.
  const area = useMemo(() => {
    const dl = 0.001;
    let s = 0;
    for (let l = dl / 2; l < 40; l += dl) s += poissonLikelihood(data, l) * dl;
    return s;
  }, [data]);

  // Left chart: probability of each possible day's sales for the current λ.
  const H = 230;
  const bx = linear([-0.5, KMAX + 0.5], [44, VW - 12]);
  const pmfMax = Math.max(0.4, ...Array.from({ length: KMAX + 1 }, (_, k) => poissonPmf(k, lambda)));
  const by = linear([0, pmfMax], [H - 34, 14]);

  // Right chart: likelihood of each λ for the fixed data.
  const lx = linear([0, LMAX], [58, VW - 14]);
  const finite = curve.filter((v) => Number.isFinite(v));
  const yMin = useLog ? Math.max(Math.min(...finite), Math.max(...finite) - 25) : 0;
  const yMax = Math.max(...finite) * (useLog ? 1 : 1.12) + (useLog ? 1 : 0);
  const ly = linear([yMin, yMax], [H - 34, 14]);
  const clampY = (v: number) => ly(Math.max(yMin, v));
  const path = grid.map((l, i) => `${i ? "L" : "M"}${lx(l).toFixed(1)},${clampY(curve[i]).toFixed(1)}`).join("");
  const current = useLog ? poissonLogLikelihood(data, lambda) : L;

  const observed = new Set(data);

  const step = (i: number, d: number) =>
    setData((prev) => prev.map((v, j) => (j === i ? Math.max(0, Math.min(KMAX, v + d)) : v)));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = VW / rect.width;
    const sx = (e.clientX - rect.left) * k;
    const l = ((sx - 58) / (VW - 14 - 58)) * LMAX;
    if (l <= 0 || l > LMAX) return setHover(null);
    const v = useLog ? poissonLogLikelihood(data, l) : poissonLikelihood(data, l);
    const box = wrap.current!.getBoundingClientRect();
    setHover({ l, x: rect.left - box.left + lx(l) / k, y: rect.top - box.top + clampY(v) / k });
  };

  return (
    <Panel title="Turn the λ dial. The data stays fixed; only your guess about the demand rate moves.">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-sm text-ink-2">Drills sold (the observed data)</div>
          <div className="mt-1 flex gap-2">
            {data.map((v, i) => (
              <div key={i} className="flex items-center rounded-lg border border-line">
                <button type="button" aria-label={`Day ${i + 1} minus one`} onClick={() => step(i, -1)} className="px-2 py-1 text-ink-2 hover:text-ink">
                  −
                </button>
                <span className="w-14 text-center text-sm tabular">
                  <span className="text-xs text-muted">D{i + 1} </span>
                  <span className="font-semibold" data-testid={`ld-day-${i}`}>{v}</span>
                </span>
                <button type="button" aria-label={`Day ${i + 1} plus one`} onClick={() => step(i, 1)} className="px-2 py-1 text-ink-2 hover:text-ink">
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-56 flex-1">
          <Slider id="ld-lambda" label="λ, your guess for the average drills per day" value={lambda} min={0.05} max={LMAX} step={0.05} onChange={setLambda} display={(v) => v.toFixed(2)} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-sm font-medium">Probability view: λ fixed at {lambda.toFixed(2)}</div>
          <div className="text-xs text-ink-2">How probable is each possible day? These bars sum to 1.</div>
          <svg viewBox={`0 0 ${VW} ${H}`} className="mt-1 w-full h-auto" role="img" aria-label="Poisson probabilities for the current lambda">
            <Axis scale={by} orient="left" at={44} gridTo={VW - 12} format={(v) => fmt(v, 1)} />
            <Axis scale={bx} orient="bottom" at={H - 34} tickValues={Array.from({ length: KMAX + 1 }, (_, k) => k)} label="drills sold in a day" />
            {Array.from({ length: KMAX + 1 }, (_, k) => {
              const p = poissonPmf(k, lambda);
              const isObs = observed.has(k);
              const w = 20;
              const top = by(p);
              const h = Math.max(0, H - 34 - top);
              return (
                <g key={k}>
                  <path
                    d={`M${bx(k) - w / 2},${H - 34} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${Math.max(0, h - 4)} z`}
                    fill={isObs ? "var(--series-2)" : "var(--series-1)"}
                    opacity={isObs ? 1 : 0.35}
                  />
                  {isObs && (
                    <text x={bx(k)} y={top - 5} textAnchor="middle" fontSize={11} fill="var(--ink)" className="tabular">
                      {p.toFixed(3)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Key color="var(--series-2)" label="Sales you actually observed" shape="bar" />
            <Key color="var(--series-1)" label="Other possible days" shape="bar" />
          </div>
        </div>

        <div ref={wrap} className="relative">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium">Likelihood view: data fixed at {data.join(", ")}</div>
            <button type="button" onClick={() => setUseLog((v) => !v)} className="text-xs text-accent hover:underline">
              {useLog ? "Show likelihood" : "Show log-likelihood"}
            </button>
          </div>
          <div className="text-xs text-ink-2">How well does each λ explain the data? This curve does not sum to 1.</div>
          <svg
            viewBox={`0 0 ${VW} ${H}`}
            className="mt-1 w-full h-auto"
            role="img"
            aria-label={`Likelihood curve with its peak at lambda equals ${mle.toFixed(2)}`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <Axis scale={ly} orient="left" at={58} gridTo={VW - 14} format={(v) => (useLog ? fmt(v, 0) : smallNumber(v))} />
            <Axis scale={lx} orient="bottom" at={H - 34} label="λ (average drills per day)" />
            {!useLog && <path d={`${path}L${lx(LMAX)},${H - 34}L${lx(0.025)},${H - 34}Z`} fill="var(--series-1)" opacity={0.1} />}
            <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
            <line x1={lx(mle)} x2={lx(mle)} y1={14} y2={H - 34} stroke="var(--ink-2)" strokeWidth={1} />
            <text
              x={lx(mle) > VW * 0.55 ? lx(mle) - 5 : lx(mle) + 5}
              y={24}
              fontSize={11}
              fill="var(--ink)"
              textAnchor={lx(mle) > VW * 0.55 ? "end" : "start"}
            >
              peak at λ = {mle.toFixed(2)} (the average)
            </text>
            <line x1={lx(lambda)} x2={lx(lambda)} y1={clampY(current)} y2={H - 34} stroke="var(--series-2)" strokeWidth={1.5} />
            <circle cx={lx(lambda)} cy={clampY(current)} r={5} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
            {hover && <line x1={lx(hover.l)} x2={lx(hover.l)} y1={14} y2={H - 34} stroke="var(--axis)" />}
          </svg>
          {hover && (
            <Tip x={hover.x} y={hover.y}>
              λ = {hover.l.toFixed(2)} → {useLog ? "log L" : "L"} ={" "}
              {useLog ? poissonLogLikelihood(data, hover.l).toFixed(2) : poissonLikelihood(data, hover.l).toExponential(3)}
            </Tip>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Key color="var(--series-1)" label="Likelihood of each λ" shape="line" />
            <Key color="var(--series-2)" label="Your current λ" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-surface-2 p-4 text-sm" data-testid="ld-product">
        <div className="text-ink-2">Likelihood of λ = {lambda.toFixed(2)} is the product of the three orange bars:</div>
        <div className="mt-1 font-mono text-[13px] tabular">
          {probs.map((p) => p.toFixed(4)).join(" × ")} = <span className="font-semibold">{L.toExponential(3)}</span>
        </div>
        <div className="mt-1 text-ink-2">
          Log-likelihood = sum of the logs = {poissonLogLikelihood(data, lambda).toFixed(3)}. Area under the
          likelihood curve = {area.toFixed(4)}, nowhere near 1, so it is not a probability distribution over λ.
        </div>
      </div>
    </Panel>
  );
}

/** Likelihood by brute force: how often does a simulated 3-day window match the data exactly? */
const SIM_LAMBDAS = [0.5, 1, 1.5, 2, 5];
const SIM_DATA = [0, 2, 1];

export function LikelihoodSimulation({ data = SIM_DATA }: { data?: number[] }) {
  const [seed, setSeed] = useState(0);
  const N = 100_000;
  const rows = useMemo(() => {
    if (seed === 0) return null;
    const rng = mulberry32(seed * 7717);
    return SIM_LAMBDAS.map((lam) => {
      let hits = 0;
      for (let i = 0; i < N; i++) {
        let match = true;
        for (const k of data) {
          if (poisson(rng, lam) !== k) {
            match = false;
            break;
          }
        }
        if (match) hits++;
      }
      return { lam, share: hits / N, exact: poissonLikelihood(data, lam) };
    });
  }, [seed, data]);
  return (
    <Panel title={`For each λ, simulate ${N.toLocaleString("en-US")} three-day windows and count exact matches with (${data.join(", ")})`}>
      {rows ? (
        <table className="w-full text-sm tabular" data-testid="lik-sim">
          <thead className="text-left text-xs text-ink-2">
            <tr>
              <th className="py-1 pr-3 font-medium">λ</th>
              <th className="py-1 pr-3 font-medium">Share of simulated windows that match</th>
              <th className="py-1 font-medium">Likelihood from the formula</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lam}>
                <td className="border-t border-line py-1 pr-3">{r.lam}</td>
                <td className="border-t border-line py-1 pr-3">{r.share.toFixed(4)}</td>
                <td className="border-t border-line py-1">{r.exact.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-2">Press the button. It runs half a million simulated windows in your browser.</p>
      )}
      <button type="button" onClick={() => setSeed((s) => s + 1)} className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white">
        {rows ? "Run again" : "Run the simulation"}
      </button>
    </Panel>
  );
}

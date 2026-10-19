"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fitLine, gradientPath, sseLine, type GradientStep } from "@/lib/sim/linreg";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

// Five weeks of one emulsion paint at Bolt & Beam: price (₹100s per litre) and litres sold.
export const LR_PRICE = [4, 5, 6, 7, 8];
export const LR_UNITS = [69, 58, 54, 42, 37];

const VW = 460;
const H = 280;
const L = 48;
const B = H - 34;

export function LinRegPlayground() {
  const [ys, setYs] = useState(LR_UNITS);
  const [a, setA] = useState(90);
  const [b, setB] = useState(-6);
  const [showBest, setShowBest] = useState(false);
  const [showSquares, setShowSquares] = useState(true);
  const [centered, setCentered] = useState(true);
  const [run, setRun] = useState<{ path: GradientStep[]; step: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);

  const x = linear([3, 9], [L, VW - 14]);
  const y = linear([0, 100], [B, 12]);
  const best = useMemo(() => fitLine(LR_PRICE, ys), [ys]);
  const yours = sseLine(LR_PRICE, ys, a, b);

  // Gradient descent from your current line, either on raw prices or on centered prices.
  const startRun = () => {
    const steps = 300;
    if (!centered) {
      setRun({ path: gradientPath(LR_PRICE, ys, 0.005, steps, { intercept: a, slope: b }), step: 0 });
      return;
    }
    // In centered coordinates the intercept is the prediction at ₹600.
    const xc = LR_PRICE.map((p) => p - 6);
    const path = gradientPath(xc, ys, 0.05, steps, { intercept: a + 6 * b, slope: b }).map((s) => ({
      ...s,
      intercept: s.intercept - 6 * s.slope,
    }));
    setRun({ path, step: 0 });
  };

  useEffect(() => {
    if (!run) return;
    const t = setTimeout(() => {
      const next = Math.min(run.step + 3, run.path.length - 1);
      setA(Math.round(run.path[next].intercept * 10) / 10);
      setB(Math.round(run.path[next].slope * 100) / 100);
      setRun(next >= run.path.length - 1 ? null : { ...run, step: next });
    }, 16);
    return () => clearTimeout(t);
  }, [run]);

  const toData = (clientY: number) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const py = ((clientY - r.top) / r.height) * H;
    const v = 100 - ((py - 12) / (B - 12)) * 100;
    return Math.max(0, Math.min(100, Math.round(v)));
  };

  const line = (ai: number, bi: number) => `M${x(3)},${y(ai + bi * 3)}L${x(9)},${y(ai + bi * 9)}`;

  return (
    <Panel
      title="Find the line by hand, then let calculus find it. Drag any week's dot up or down."
      footer={
        <>
          Your line: <span className="font-semibold tabular">ŷ = {fmt(a, 1)} {b < 0 ? "−" : "+"} {fmt(Math.abs(b), 2)}·price</span>, squared error{" "}
          <span className="font-semibold tabular" data-testid="lr-sse">{fmt(yours, 1)}</span>.{" "}
          Best possible:{" "}
          <span className="font-semibold tabular" data-testid="lr-best">
            ŷ = {fmt(best.intercept, 1)} {best.slope < 0 ? "−" : "+"} {fmt(Math.abs(best.slope), 2)}·price, error {fmt(best.sse, 1)}
          </span>
          .
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="lr-a" label="Intercept a (litres at price 0)" value={a} min={40} max={140} step={0.5} onChange={setA} />
        <Slider id="lr-b" label="Slope b (litres per ₹100)" value={b} min={-16} max={0} step={0.25} onChange={setB} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showSquares} onChange={(e) => setShowSquares(e.target.checked)} /> Show the squares
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} /> Show the best line
        </label>
        <button
          type="button"
          onClick={startRun}
          disabled={run !== null}
          className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          Roll downhill (gradient descent)
        </button>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={centered} onChange={(e) => setCentered(e.target.checked)} disabled={run !== null} /> Center prices first
        </label>
        <button type="button" onClick={() => setYs(LR_UNITS)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
          Reset dots
        </button>
      </div>
      {run && (
        <div className="mt-2 text-xs text-ink-2 tabular">
          Gradient step {run.step} of {run.path.length - 1}: error {fmt(run.path[run.step].sse, 1)}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${H}`}
        className="mt-3 h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Five weeks of paint sales against price, with your line (squared error ${fmt(yours, 1)})`}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          const i = drag.current;
          const v = toData(e.clientY);
          setYs((prev) => prev.map((p, j) => (j === i ? v : p)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="litres / week" />
        <Axis scale={x} orient="bottom" at={B} format={(v) => `₹${v * 100}`} label="price per litre" />
        {showSquares &&
          LR_PRICE.map((p, i) => {
            const pred = a + b * p;
            const side = Math.abs(y(ys[i]) - y(pred));
            return (
              <rect
                key={i}
                x={x(p)}
                y={Math.min(y(ys[i]), y(pred))}
                width={side}
                height={side}
                fill="var(--series-3)"
                fillOpacity={0.18}
                stroke="var(--series-3)"
                strokeWidth={1}
              />
            );
          })}
        {LR_PRICE.map((p, i) => (
          <line key={i} x1={x(p)} x2={x(p)} y1={y(ys[i])} y2={y(a + b * p)} stroke="var(--muted)" />
        ))}
        {showBest && <path d={line(best.intercept, best.slope)} stroke="var(--series-2)" strokeWidth={2} strokeDasharray="5 4" fill="none" />}
        <path d={line(a, b)} stroke="var(--series-1)" strokeWidth={2.5} fill="none" />
        {LR_PRICE.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(p)}
              cy={y(ys[i])}
              r={7}
              fill="var(--ink)"
              stroke="var(--surface-1)"
              strokeWidth={2}
              className="cursor-ns-resize"
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                drag.current = i;
              }}
              aria-label={`Week ${i + 1}: ${ys[i]} litres at ₹${p * 100}`}
            />
            <text x={x(p) - 10} y={y(ys[i]) - 10} fontSize={11} fill="var(--ink-2)" textAnchor="end" className="tabular">
              {ys[i]}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="A week of sales (drag me)" />
        <Key color="var(--series-1)" label="Your line" shape="line" />
        {showBest && <Key color="var(--series-2)" label="Least-squares line" shape="line" />}
        {showSquares && <Key color="var(--series-3)" label="Squared residual, drawn as a real square" shape="bar" />}
      </div>
    </Panel>
  );
}

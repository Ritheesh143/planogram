"use client";

import type { ReactNode } from "react";

// Small chart toolkit shared by the lesson visuals: scales, axes, sliders, tooltip.

export type Scale = ((v: number) => number) & { domain: [number, number]; range: [number, number] };

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const f = ((v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0)) as Scale;
  f.domain = domain;
  f.range = range;
  return f;
}

/** Round tick values (1, 2, 5 × 10^k steps). */
export function ticks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Number(v.toFixed(10)));
  }
  return out;
}

export function fmt(v: number, digits = 2): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

type AxisProps = {
  scale: Scale;
  orient: "bottom" | "left";
  at: number;
  tickValues?: number[];
  format?: (v: number) => string;
  label?: string;
  gridTo?: number;
};

/** Recessive axis with hairline gridlines. */
export function Axis({ scale, orient, at, tickValues, format = (v) => fmt(v), label, gridTo }: AxisProps) {
  const [d0, d1] = scale.domain;
  const vals = tickValues ?? ticks(Math.min(d0, d1), Math.max(d0, d1));
  if (orient === "bottom") {
    const [r0, r1] = scale.range;
    return (
      <g fontSize={11} fill="var(--muted)">
        <line x1={r0} x2={r1} y1={at} y2={at} stroke="var(--axis)" />
        {vals.map((v) => (
          <g key={v}>
            {gridTo !== undefined && <line x1={scale(v)} x2={scale(v)} y1={at} y2={gridTo} stroke="var(--grid)" />}
            <text x={scale(v)} y={at + 15} textAnchor="middle" className="tabular">
              {format(v)}
            </text>
          </g>
        ))}
        {label && (
          <text x={(r0 + r1) / 2} y={at + 29} textAnchor="middle" fill="var(--ink-2)">
            {label}
          </text>
        )}
      </g>
    );
  }
  const [r0, r1] = scale.range;
  return (
    <g fontSize={11} fill="var(--muted)">
      {vals.map((v) => (
        <g key={v}>
          {gridTo !== undefined && <line x1={at} x2={gridTo} y1={scale(v)} y2={scale(v)} stroke="var(--grid)" />}
          <text x={at - 6} y={scale(v) + 4} textAnchor="end" className="tabular">
            {format(v)}
          </text>
        </g>
      ))}
      {label && (
        <text
          x={at - 36}
          y={(r0 + r1) / 2}
          textAnchor="middle"
          fill="var(--ink-2)"
          transform={`rotate(-90 ${at - 36} ${(r0 + r1) / 2})`}
        >
          {label}
        </text>
      )}
    </g>
  );
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display?: (v: number) => string;
  id?: string;
};

export function Slider({ label, value, min, max, step, onChange, display, id }: SliderProps) {
  const inputId = id ?? `s-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={inputId} className="text-ink-2">
          {label}
        </label>
        <span className="font-semibold tabular" data-testid={`${inputId}-value`}>
          {display ? display(value) : value}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </div>
  );
}

export function Panel({ title, children, footer }: { title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <figure className="rounded-xl border border-line bg-surface-1 p-4">
      {title && <figcaption className="mb-3 text-sm font-medium">{title}</figcaption>}
      {children}
      {footer && <div className="mt-3 text-sm text-ink-2">{footer}</div>}
    </figure>
  );
}

/** Legend entry: a colored key beside text in ink (text never wears the series color). */
export function Key({ color, label, shape = "dot" }: { color: string; label: ReactNode; shape?: "dot" | "line" | "bar" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <svg width="14" height="10" aria-hidden>
        {shape === "dot" && <circle cx="7" cy="5" r="4" fill={color} />}
        {shape === "line" && <line x1="0" x2="14" y1="5" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />}
        {shape === "bar" && <rect x="2" y="0" width="10" height="10" rx="2" fill={color} />}
      </svg>
      {label}
    </span>
  );
}

export function Tip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs shadow-md"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

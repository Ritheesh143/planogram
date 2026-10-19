"use client";

import { useMemo, useState } from "react";
import { fitLasso, fitLinear } from "@/lib/sim/linreg";
import { xtx } from "@/lib/sim/linalg";
import { mulberry32, normal } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 300;

// 16 weeks of a paint SKU: price matters a lot, shelf facings a little. Both standardized.
function weeks() {
  const rng = mulberry32(31);
  const raw = Array.from({ length: 16 }, () => [4 + rng() * 4, 2 + Math.floor(rng() * 5)]);
  const y = raw.map(([p, f]) => 100 - 8 * p + 1.2 * f + normal(rng, 0, 3));
  const mean = (j: number) => raw.reduce((s, r) => s + r[j], 0) / raw.length;
  const sd = (j: number, m: number) => Math.sqrt(raw.reduce((s, r) => s + (r[j] - m) ** 2, 0) / raw.length);
  const m0 = mean(0);
  const m1 = mean(1);
  const s0 = sd(0, m0);
  const s1 = sd(1, m1);
  return { X: raw.map(([p, f]) => [(p - m0) / s0, (f - m1) / s1]), y };
}

const DATA = weeks();

/** Points on the ellipse (β − β̂)ᵀ A (β − β̂) = c. */
function ellipse(A: number[][], center: number[], c: number): string {
  const [[p, q], [, r]] = A;
  const mid = (p + r) / 2;
  const rad = Math.sqrt(((p - r) / 2) ** 2 + q * q);
  const l1 = mid + rad;
  const l2 = mid - rad;
  let v1 = Math.abs(q) < 1e-12 ? [1, 0] : [q, l1 - p];
  const n = Math.hypot(v1[0], v1[1]);
  v1 = [v1[0] / n, v1[1] / n];
  const v2 = [-v1[1], v1[0]];
  const pts: number[][] = [];
  for (let i = 0; i <= 96; i++) {
    const t = (2 * Math.PI * i) / 96;
    const a = Math.sqrt(c / l1) * Math.cos(t);
    const b = Math.sqrt(c / l2) * Math.sin(t);
    pts.push([center[0] + a * v1[0] + b * v2[0], center[1] + a * v1[1] + b * v2[1]]);
  }
  return pts.map((pt) => pt.join(",")).join(" ");
}

export function RidgeLassoGeometry() {
  const data = DATA;
  const [kind, setKind] = useState<"ridge" | "lasso">("lasso");
  const [strength, setStrength] = useState(0.4);
  const ols = useMemo(() => fitLinear(data.X, data.y), [data]);
  const A = useMemo(() => {
    const m = [0, 1].map((j) => data.X.reduce((s, r) => s + r[j], 0) / data.X.length);
    return xtx(data.X.map((r) => r.map((v, j) => v - m[j])));
  }, [data]);
  // Map the 0–1 slider to a penalty that spans "barely" to "everything is zero".
  const maxPen = kind === "ridge" ? 400 : Math.max(...[0, 1].map((j) => Math.abs(A[j][0] * ols.coef[0] + A[j][1] * ols.coef[1]))) * 1.05;
  const pen = kind === "ridge" ? maxPen * strength ** 2 : maxPen * strength;
  const fit = (k: typeof kind, v: number) => (k === "ridge" ? fitLinear(data.X, data.y, v) : fitLasso(data.X, data.y, v, 300));
  const cur = fit(kind, pen);
  const path = useMemo(
    () => Array.from({ length: 41 }, (_, i) => fit(kind, kind === "ridge" ? maxPen * (i / 40) ** 2 : maxPen * (i / 40)).coef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, maxPen],
  );

  const lim = Math.max(Math.abs(ols.coef[0]), Math.abs(ols.coef[1])) * 1.25;
  const sx = linear([-lim, lim], [56, VW - 14]);
  const sy = linear([-lim * 0.55, lim * 0.55], [H - 34, 12]);
  const toPx = (pts: string) =>
    pts
      .split(" ")
      .map((p) => {
        const [a, b] = p.split(",").map(Number);
        return `${sx(a).toFixed(1)},${sy(b).toFixed(1)}`;
      })
      .join(" ");

  const d = cur.coef.map((c, j) => c - ols.coef[j]);
  const level = d[0] * (A[0][0] * d[0] + A[0][1] * d[1]) + d[1] * (A[1][0] * d[0] + A[1][1] * d[1]);
  const budget = kind === "ridge" ? Math.hypot(cur.coef[0], cur.coef[1]) : Math.abs(cur.coef[0]) + Math.abs(cur.coef[1]);
  const shape =
    kind === "ridge"
      ? Array.from({ length: 97 }, (_, i) => {
          const t = (2 * Math.PI * i) / 96;
          return `${budget * Math.cos(t)},${budget * Math.sin(t)}`;
        }).join(" ")
      : `${budget},0 0,${budget} ${-budget},0 0,${-budget} ${budget},0`;

  return (
    <Panel
      title="Ridge vs Lasso: the error ellipse grows until it touches the budget shape"
      footer={
        <>
          Coefficients (standardized):{" "}
          <span className="font-semibold tabular" data-testid="rl-coef">
            price {fmt(cur.coef[0], 2)}, facings {fmt(cur.coef[1], 2)}
          </span>
          . Least squares alone gives price {fmt(ols.coef[0], 2)}, facings {fmt(ols.coef[1], 2)}.
          {kind === "lasso" && Math.abs(cur.coef[1]) < 1e-9 && " The facings coefficient is exactly zero: the diamond's corner did it."}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Penalty">
        {(["ridge", "lasso"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={kind === k ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {k === "ridge" ? "Ridge (L2, circle)" : "Lasso (L1, diamond)"}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Slider id="rl-strength" label="Penalty strength" value={strength} min={0} max={1} step={0.02} onChange={setStrength} display={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Coefficient plane with error ellipses and the penalty shape">
        <defs>
          <clipPath id="rl-plot">
            <rect x={56} y={12} width={VW - 70} height={H - 46} />
          </clipPath>
        </defs>
        <Axis scale={sx} orient="bottom" at={H - 34} label="price coefficient" />
        <Axis scale={sy} orient="left" at={56} gridTo={VW - 14} label="facings coef." />
        <line x1={sx(0)} x2={sx(0)} y1={12} y2={H - 34} stroke="var(--axis)" />
        <line x1={56} x2={VW - 14} y1={sy(0)} y2={sy(0)} stroke="var(--axis)" />
        <g clipPath="url(#rl-plot)">
        {[0.25, 1, 2.5].map((m) => (
          <polyline key={m} points={toPx(ellipse(A, ols.coef, Math.max(level, 1e-6) * m))} fill="none" stroke="var(--series-1)" strokeWidth={m === 1 ? 2 : 1} strokeOpacity={m === 1 ? 1 : 0.35} />
        ))}
        {budget > 1e-9 && <polyline points={toPx(shape)} fill="var(--series-2)" fillOpacity={0.12} stroke="var(--series-2)" strokeWidth={2} />}
        <polyline points={path.map((c) => `${sx(c[0]).toFixed(1)},${sy(c[1]).toFixed(1)}`).join(" ")} fill="none" stroke="var(--muted)" strokeDasharray="3 3" />
        </g>
        <circle cx={sx(ols.coef[0])} cy={sy(ols.coef[1])} r={4} fill="var(--series-1)" />
        <text x={sx(ols.coef[0]) + 6} y={sy(ols.coef[1]) - 6} fontSize={11} fill="var(--ink-2)">
          least squares
        </text>
        <circle cx={sx(cur.coef[0])} cy={sy(cur.coef[1])} r={6} fill="var(--ink)" stroke="var(--surface-1)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Equal-error ellipses around the least-squares answer" shape="line" />
        <Key color="var(--series-2)" label={kind === "ridge" ? "Budget: β₁² + β₂² ≤ t" : "Budget: |β₁| + |β₂| ≤ t"} shape="bar" />
        <Key color="var(--muted)" label="Path as the penalty grows" shape="line" />
        <Key color="var(--ink)" label="Penalized answer" />
      </div>
    </Panel>
  );
}

const ALIKE = [1, 0.3, 0.1, 0.03, 0.01];

/** Two price columns that move together: each coefficient wanders, their sum stays put. */
export function CollinearCloud() {
  const [idx, setIdx] = useState(2);
  const noise = ALIKE[idx];
  const draws = useMemo(() => {
    return Array.from({ length: 60 }, (_, seed) => {
      const rng = mulberry32(1000 + seed);
      const X = Array.from({ length: 30 }, () => {
        const p = 4 + rng() * 4;
        return [p, p + normal(rng, 0, noise)];
      });
      const y = X.map(([shelf]) => 100 - 8 * shelf + normal(rng, 0, 2));
      return fitLinear(X, y).coef;
    });
  }, [noise]);
  const sd = (v: number[]) => {
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
  };
  // Zoom to the cloud, so the axes grow as the two prices become harder to tell apart.
  const lim = Math.max(10, ...draws.map((c) => Math.max(Math.abs(c[0] + 8), Math.abs(c[1])))) * 1.1;
  const sx = linear([-8 - lim, -8 + lim], [56, VW - 14]);
  const sy = linear([-lim, lim], [H - 34, 12]);
  return (
    <Panel
      title="Shelf price and app price move together. Refit on 60 fresh samples of 30 weeks each."
      footer={
        <>
          Spread of the shelf-price coefficient:{" "}
          <span className="font-semibold tabular" data-testid="cc-spread">±{fmt(sd(draws.map((c) => c[0])), 1)}</span>. Spread of the two added together:{" "}
          <span className="font-semibold tabular">±{fmt(sd(draws.map((c) => c[0] + c[1])), 2)}</span>. The model knows the total price effect, not who owns it.
        </>
      }
    >
      <Slider
        id="cc-alike"
        label="How far app price strays from shelf price (₹100s)"
        value={idx}
        min={0}
        max={ALIKE.length - 1}
        step={1}
        onChange={setIdx}
        display={(i) => `±${ALIKE[i]}`}
      />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Scatter of the two price coefficients across refits">
        <Axis scale={sx} orient="bottom" at={H - 34} label="shelf-price coefficient" />
        <Axis scale={sy} orient="left" at={56} gridTo={VW - 14} label="app-price coef." />
        <line x1={sx(-8 - lim)} y1={sy(lim)} x2={sx(-8 + lim)} y2={sy(-lim)} stroke="var(--series-2)" strokeDasharray="5 4" />
        {draws.map((c, i) => (
          <circle key={i} cx={sx(Math.max(-8 - lim, Math.min(-8 + lim, c[0])))} cy={sy(Math.max(-lim, Math.min(lim, c[1])))} r={3.5} fill="var(--series-1)" fillOpacity={0.7} />
        ))}
        <circle cx={sx(-8)} cy={sy(0)} r={6} fill="none" stroke="var(--ink)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="One refit's two coefficients" />
        <Key color="var(--series-2)" label="Shelf + app = −8 (the total effect)" shape="line" />
        <Key color="var(--ink)" label="Truth: shelf −8, app 0" />
      </div>
    </Panel>
  );
}

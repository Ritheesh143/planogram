"use client";

import { useEffect, useState } from "react";
import { evaluate, gridFor, MODEL_IDS, MODEL_NAMES, type ModelResult } from "@/lib/sim/failureLab";
import { scenarios, type ModelId, type Scenario } from "@/lib/sim/scenarios";
import { Axis, fmt, Key, linear, Panel } from "./kit";

const COLORS: Record<ModelId, string> = {
  linear: "var(--series-1)",
  tree: "var(--series-2)",
  gbm: "var(--series-3)",
  mlp: "var(--series-4)",
};

const VW = 520;
const H = 300;
const L = 52;
const B = H - 34;

// Fits are deterministic, so each scenario is computed once per page load.
const cache = new Map<string, ModelResult[]>();

function useResults(s: Scenario): ModelResult[] | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (cache.has(s.id)) return;
    const t = setTimeout(() => {
      cache.set(s.id, MODEL_IDS.map((id) => evaluate(s, id)));
      force((n) => n + 1);
    }, 30);
    return () => clearTimeout(t);
  }, [s]);
  return cache.get(s.id) ?? null;
}

export function FailureLab({ focus, start = "trend", only }: { focus?: ModelId; start?: string; only?: string[] }) {
  const list = only ? scenarios.filter((s) => only.includes(s.id)) : scenarios;
  const [id, setId] = useState(start);
  const s = list.find((x) => x.id === id) ?? list[0];
  const results = useResults(s);
  const [hidden, setHidden] = useState<Set<ModelId>>(new Set());

  const grid = gridFor(s);
  const groups = s.groups ? [0, 1] : [null];
  const curves = results?.map((r) => ({
    id: r.id,
    lines: groups.map((g) => grid.map((x) => [x, r.predict(g === null ? [x] : [x, g])] as const)),
  }));

  const ally = [...s.train.y, ...s.test.y, ...(curves?.flatMap((c) => c.lines.flat().map((p) => p[1])) ?? [])];
  const lo = Math.min(0, ...ally);
  const hi = Math.max(...ally);
  const x = linear(s.domain, [L, VW - 14]);
  const y = linear([lo, hi + (hi - lo) * 0.05], [B, 12]);
  const trainXs = s.train.X.map((r) => r[0]);
  const trainMax = Math.max(...trainXs);
  // Shade the extrapolation zone only when the test data reaches well past the training data.
  const beyond = Math.max(...s.test.X.map((r) => r[0])) - trainMax > 0.1 * (s.domain[1] - s.domain[0]);

  const marker = (cx: number, cy: number, g: number, filled: boolean, key: string) =>
    g === 1 ? (
      <rect key={key} x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={filled ? "var(--ink-2)" : "none"} stroke="var(--ink-2)" strokeWidth={1.2} />
    ) : (
      <circle key={key} cx={cx} cy={cy} r={3.5} fill={filled ? "var(--ink-2)" : "none"} stroke="var(--ink-2)" strokeWidth={1.2} />
    );

  const best = results ? Math.min(...results.map((r) => r.testRmse)) : 0;

  return (
    <Panel title="Failure Lab: the same data, four models, one held-out test">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Scenario">
        {list.map((sc) => (
          <button
            key={sc.id}
            type="button"
            role="tab"
            aria-selected={sc.id === s.id}
            data-testid={`fl-scenario-${sc.id}`}
            onClick={() => setId(sc.id)}
            className={
              sc.id === s.id
                ? "rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-lg border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-accent"
            }
          >
            {sc.name}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-2">{s.story}</p>

      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`${s.name}: each model's fitted curve over the data`}>
        {beyond && (
          <g>
            <rect x={x(trainMax)} y={12} width={x(s.domain[1]) - x(trainMax)} height={B - 12} fill="var(--surface-2)" />
            <text x={x(trainMax) + 6} y={26} fontSize={11} fill="var(--ink-2)">
              beyond the training data
            </text>
          </g>
        )}
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label={s.yLabel} />
        <Axis scale={x} orient="bottom" at={B} label={s.xLabel} />
        {lo < 0 && <line x1={L} x2={VW - 14} y1={y(0)} y2={y(0)} stroke="var(--ink-2)" strokeWidth={1} />}
        {s.test.X.map((r, i) => marker(x(r[0]), y(s.test.y[i]), r[1] ?? 0, false, `te${i}`))}
        {s.train.X.map((r, i) => marker(x(r[0]), y(s.train.y[i]), r[1] ?? 0, true, `tr${i}`))}
        {curves?.map((c) =>
          hidden.has(c.id)
            ? null
            : c.lines.map((pts, g) => (
                <polyline
                  key={`${c.id}${g}`}
                  points={pts.map(([px, py]) => `${x(px).toFixed(1)},${y(Math.max(lo, Math.min(hi, py))).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={COLORS[c.id]}
                  strokeWidth={focus === c.id ? 3 : 2}
                  strokeOpacity={focus && focus !== c.id ? 0.55 : 1}
                  strokeDasharray={g === 1 ? "6 4" : undefined}
                  strokeLinejoin="round"
                />
              )),
        )}
        {!results && (
          <text x={VW / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--ink-2)">
            Training four models…
          </text>
        )}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink-2)" label="Training rows" />
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" />
          </svg>
          Held-out test rows
        </span>
        {s.groups && (
          <span className="text-xs text-ink-2">
            Circles and solid lines: {s.groups[0]}. Squares and dashed lines: {s.groups[1]}.
          </span>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead className="text-left text-xs text-ink-2">
            <tr>
              <th className="py-1 pr-3 font-medium">Show</th>
              <th className="py-1 pr-3 font-medium">Model</th>
              <th className="py-1 pr-3 font-medium">Train error</th>
              <th className="py-1 pr-3 font-medium">Test error</th>
              {s.check && <th className="py-1 pr-3 font-medium">{s.check === "negatives" ? "Predicts < 0" : "Rises with price"}</th>}
            </tr>
          </thead>
          <tbody>
            {MODEL_IDS.map((m) => {
              const r = results?.find((x) => x.id === m);
              return (
                <tr key={m} className={focus === m ? "bg-accent-wash" : ""}>
                  <td className="border-t border-line py-1 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`Show ${MODEL_NAMES[m]}`}
                      checked={!hidden.has(m)}
                      onChange={() =>
                        setHidden((h) => {
                          const n = new Set(h);
                          if (n.has(m)) n.delete(m);
                          else n.add(m);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td className="border-t border-line py-1 pr-3">
                    <Key color={COLORS[m]} label={<span className={focus === m ? "font-semibold text-ink" : "text-ink"}>{MODEL_NAMES[m]}</span>} shape="line" />
                  </td>
                  <td className="border-t border-line py-1 pr-3">{r ? fmt(r.trainRmse, 1) : "…"}</td>
                  <td className="border-t border-line py-1 pr-3" data-testid={`fl-test-${m}`}>
                    {r ? (
                      <>
                        {fmt(r.testRmse, 1)} {Math.abs(r.testRmse - best) < 1e-9 && <span className="text-good">✓ best</span>}
                      </>
                    ) : (
                      "…"
                    )}
                  </td>
                  {s.check && <td className="border-t border-line py-1 pr-3">{r?.checkValue !== undefined ? `${Math.round(r.checkValue * 100)}% of the range` : "…"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted">Errors are root-mean-squared, in the units of the vertical axis.</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {MODEL_IDS.map((m) => (
          <div key={m} className={`rounded-lg p-3 text-sm ${focus === m ? "bg-accent-wash" : "bg-surface-2"}`}>
            <div className="mb-1 font-medium">
              <Key color={COLORS[m]} label={<span className="text-ink">{MODEL_NAMES[m]}</span>} shape="line" />
            </div>
            {s.verdict[m]}
          </div>
        ))}
      </div>
    </Panel>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import arena from "@/public/data/arena.json";
import { fmt, Key, Panel } from "./kit";

type Result = {
  wape: number;
  deviance: number;
  rmse: number;
  bias: number;
  negative: number;
  seconds: number;
  size_kb: number | null;
  price_rises?: number;
};
type ArenaScenario = {
  id: string;
  name: string;
  story: string;
  metric: "wape" | "deviance";
  lesson: string;
  train_rows: number;
  test_rows: number;
  results: Record<string, Result>;
};

const data = arena as unknown as {
  models: { id: string; name: string; family: string }[];
  scenarios: ArenaScenario[];
  meta: { versions: Record<string, string>; stores: number; skus: number };
};

export const ARENA = data;

const SEQ = ["var(--seq-100)", "var(--seq-250)", "var(--seq-400)", "var(--seq-550)", "var(--seq-700)"];
const LESSON_HREF: Record<string, string> = {
  "tree-vs-mlp": "/learn/models/tree-vs-mlp",
  "mle-peak": "/learn/bayes/mle-peak",
  "xgb-lgbm-catboost": "/models/xgb-lgbm-catboost",
  "linear-regression": "/models/linear-regression",
};

/** How much worse than the scenario's best model, as a fraction (0 = best). */
export function gapToBest(sc: ArenaScenario, modelId: string): number {
  const vals = Object.values(sc.results).map((r) => r[sc.metric]);
  const best = Math.min(...vals);
  return sc.results[modelId][sc.metric] / best - 1;
}

/** Gaps under 1% keep a decimal, so a near-tie doesn't read as "+0%". */
const pct = (gap: number) => (gap < 0.01 ? fmt(gap * 100, 1) : fmt(gap * 100, 0));

const ON_SEQ = ["var(--on-seq-100)", "var(--on-seq-250)", "var(--on-seq-400)", "var(--on-seq-550)", "var(--on-seq-700)"];

/** 0–2% is the best band, then steps at 5%, 10% and 25%: stronger means further from the best. */
function step(gap: number): number {
  const i = [0.02, 0.05, 0.1, 0.25].findIndex((s) => gap <= s);
  return i === -1 ? 4 : i;
}

export function FailureMatrix() {
  const [sel, setSel] = useState<{ s: string; m: string }>({ s: data.scenarios[0].id, m: data.models[0].id });
  const sc = data.scenarios.find((x) => x.id === sel.s)!;
  const ranked = [...data.models].sort((a, b) => sc.results[a.id][sc.metric] - sc.results[b.id][sc.metric]);
  const r = sc.results[sel.m];
  const modelName = data.models.find((m) => m.id === sel.m)!.name;
  const metricName = (s: ArenaScenario) => (s.metric === "wape" ? "WAPE" : "Poisson deviance");

  return (
    <Panel
      title="The Failure Matrix: every model on every scenario, shaded by how far it is from that scenario's best"
      footer={
        <>
          Click any cell. Each column is ranked on its own metric ({data.scenarios.filter((s) => s.metric === "wape").length} on WAPE, the slow movers on Poisson deviance), so shades compare
          models within a scenario, not scenarios with each other.
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-xs tabular" data-testid="fm-table">
          <thead>
            <tr>
              <th className="p-1 text-left font-medium text-ink-2">Model</th>
              {data.scenarios.map((s) => (
                <th key={s.id} className="p-1 text-left align-bottom font-medium text-ink-2">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.models.map((m) => (
              <tr key={m.id}>
                <th scope="row" className="whitespace-nowrap p-1 text-left font-medium text-ink">
                  {m.name}
                </th>
                {data.scenarios.map((s) => {
                  const gap = gapToBest(s, m.id);
                  const active = sel.s === s.id && sel.m === m.id;
                  return (
                    <td key={s.id} className="p-0">
                      <button
                        type="button"
                        onClick={() => setSel({ s: s.id, m: m.id })}
                        data-testid={`fm-${s.id}-${m.id}`}
                        aria-label={`${m.name} on ${s.name}: ${gap < 1e-9 ? "best" : `${pct(gap)}% worse than the best`}`}
                        className={`h-9 w-full rounded-md text-center ${active ? "ring-2 ring-[var(--ink)]" : ""}`}
                        style={{ background: SEQ[step(gap)], color: ON_SEQ[step(gap)] }}
                      >
                        {gap < 1e-9 ? "best" : `+${pct(gap)}%`}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Key color={SEQ[0]} label="Within 2% of the best" shape="bar" />
        <Key color={SEQ[1]} label="2–5% worse" shape="bar" />
        <Key color={SEQ[2]} label="5–10%" shape="bar" />
        <Key color={SEQ[3]} label="10–25%" shape="bar" />
        <Key color={SEQ[4]} label="More than 25% worse" shape="bar" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="font-semibold">{sc.name}</div>
          <p className="mt-1 text-ink-2">{sc.story}</p>
          <p className="mt-1 text-xs text-muted">
            {sc.train_rows.toLocaleString("en-IN")} training rows, {sc.test_rows.toLocaleString("en-IN")} test rows.
            {sc.lesson && LESSON_HREF[sc.lesson] && (
              <>
                {" "}
                <Link className="text-accent hover:underline" href={LESSON_HREF[sc.lesson]}>
                  The lesson behind this →
                </Link>
              </>
            )}
          </p>
          <div className="mt-3 font-medium" data-testid="fm-detail">
            {modelName}: {metricName(sc)} {fmt(r[sc.metric], 3)}, bias {r.bias > 0 ? "+" : ""}
            {fmt(r.bias * 100, 1)}%, trained in {fmt(r.seconds, 1)} s
            {r.negative > 0 ? `, ${fmt(r.negative * 100, 1)}% of forecasts below zero` : ""}.
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Leaderboard: {sc.name}</div>
          <table className="mt-1 w-full text-xs tabular">
            <thead className="text-left text-ink-2">
              <tr>
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">Model</th>
                <th className="py-1 pr-2 font-medium">{metricName(sc)}</th>
                <th className="py-1 pr-2 font-medium">Bias</th>
                <th className="py-1 font-medium">Seconds</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((m, i) => (
                <tr key={m.id} className={m.id === sel.m ? "font-semibold" : ""}>
                  <td className="border-t border-line py-1 pr-2">{i + 1}</td>
                  <td className="border-t border-line py-1 pr-2">{m.name}</td>
                  <td className="border-t border-line py-1 pr-2">{fmt(sc.results[m.id][sc.metric], 3)}</td>
                  <td className="border-t border-line py-1 pr-2">
                    {sc.results[m.id].bias > 0 ? "+" : ""}
                    {fmt(sc.results[m.id].bias * 100, 1)}%
                  </td>
                  <td className="border-t border-line py-1">{fmt(sc.results[m.id].seconds, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

/** Training time and model size on the main task: what the leaderboard doesn't show. */
export function ArenaCosts() {
  const base = data.scenarios.find((s) => s.id === "baseline")!;
  const rows = data.models.map((m) => ({ ...m, ...base.results[m.id] }));
  const maxS = Math.max(...rows.map((r) => r.seconds));
  return (
    <Panel title={`Cost on the main task (${base.train_rows.toLocaleString("en-IN")} training rows, one CPU machine, 4 threads)`}>
      <table className="w-full text-xs tabular">
        <thead className="text-left text-ink-2">
          <tr>
            <th className="py-1 pr-2 font-medium">Model</th>
            <th className="py-1 pr-2 font-medium">WAPE</th>
            <th className="w-1/3 py-1 pr-2 font-medium">Training time</th>
            <th className="py-1 pr-2 font-medium">Size</th>
            <th className="py-1 font-medium">Deeper discount lowers the forecast</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="border-t border-line py-1 pr-2">{r.name}</td>
              <td className="border-t border-line py-1 pr-2">{fmt(r.wape, 3)}</td>
              <td className="border-t border-line py-1 pr-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 shrink-0 rounded-sm" style={{ width: `${Math.max(2, (r.seconds / maxS) * 70)}%`, background: "var(--series-1)" }} />
                  <span className="whitespace-nowrap">{fmt(r.seconds, 1)} s</span>
                </div>
              </td>
              <td className="border-t border-line py-1 pr-2">{r.size_kb === null ? "—" : r.size_kb > 1024 ? `${fmt(r.size_kb / 1024, 1)} MB` : `${fmt(r.size_kb, 0)} KB`}</td>
              <td className="border-t border-line py-1" data-testid={`ac-rises-${r.id}`}>
                {fmt((r.price_rises ?? 0) * 100, 1)}% of promo weeks
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

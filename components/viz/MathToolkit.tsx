"use client";

import { useMemo, useState } from "react";
import { betaCdf, betaPdf } from "@/lib/sim/bayes";
import { dot, matVec, transpose, xtx } from "@/lib/sim/linalg";
import { mulberry32 } from "@/lib/sim/rng";
import { barSum, cosine, norm, randomShoppers, topK, type BarRule, type Shopper } from "@/lib/sim/toolkit";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 250;
const L = 48;
const B = H - 34;

// ---------- Integrals as sums of thin bars ----------

const RULES: { id: BarRule; name: string }[] = [
  { id: "left", name: "Left edge" },
  { id: "right", name: "Right edge" },
  { id: "mid", name: "Middle" },
];

/** Warm-up: the area under f(x) = 2x on [0, 1], which is exactly 1. */
export function BarRules() {
  const [n, setN] = useState(4);
  const [rule, setRule] = useState<BarRule>("left");
  const f = (x: number) => 2 * x;
  const dx = 1 / n;
  const shift = rule === "left" ? 0 : rule === "right" ? 1 : 0.5;
  const sum = barSum(f, 0, 1, n, rule);
  const x = linear([0, 1], [L, VW - 14]);
  const y = linear([0, 2], [B, 12]);
  return (
    <Panel
      title="The area under f(x) = 2x from 0 to 1, built from bars"
      footer={
        <>
          {n} bars of width {fmt(dx, 3)}, height taken at the {rule === "mid" ? "middle" : `${rule} edge`}: total area{" "}
          <span className="font-semibold tabular" data-testid="br-sum">{fmt(sum, 4)}</span>. The true area (a triangle, ½ × 1 × 2) is 1.
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where to measure each bar's height">
        {RULES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={rule === r.id}
            onClick={() => setRule(r.id)}
            className={rule === r.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {r.name}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Slider id="br-n" label="Number of bars" value={n} min={1} max={40} step={1} onChange={setN} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`${n} bars under the line y = 2x, total area ${fmt(sum, 4)}`}>
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="f(x)" />
        <Axis scale={x} orient="bottom" at={B} label="x" />
        {Array.from({ length: n }, (_, i) => {
          const h = f((i + shift) * dx);
          return <rect key={i} x={x(i * dx)} y={y(h)} width={x(dx) - x(0)} height={B - y(h)} fill="var(--series-1)" fillOpacity={0.35} stroke="var(--series-1)" strokeWidth={1} />;
        })}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(2)} stroke="var(--ink)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="f(x) = 2x" shape="line" />
        <Key color="var(--series-1)" label="Bars: height × width, then add them up" shape="bar" />
      </div>
    </Panel>
  );
}

// An endcap's conversion rate is uncertain; Beta(5, 15) says how plausible each rate is.
export const ENDCAP_A = 5;
export const ENDCAP_B = 15;
export const BAR_COUNTS = [10, 20, 50, 100, 200, 500];
const endcap = (x: number) => betaPdf(x, ENDCAP_A, ENDCAP_B);

/** Probability is area: shade the bars left of a cut-off and add them up. */
export function ThinBars() {
  const [nIdx, setNIdx] = useState(0);
  const [cut, setCut] = useState(0.3);
  const n = BAR_COUNTS[nIdx];
  const dx = 1 / n;
  const shaded = Math.round(cut * n);
  const prob = barSum(endcap, 0, cut, shaded, "mid");
  const area = barSum(endcap, 0, 1, n, "mid");
  const mean = barSum((v) => v * endcap(v), 0, 1, n, "mid");
  const exact = betaCdf(cut, ENDCAP_A, ENDCAP_B);
  const x = linear([0, 0.7], [L, VW - 14]);
  const y = linear([0, 4.5], [B, 12]);
  const visible = Math.ceil(0.7 * n);
  const xs = Array.from({ length: 141 }, (_, i) => i * 0.005);
  return (
    <Panel
      title="An endcap's conversion rate, Beta(5, 15): probability is the area of the bars"
      footer={
        <>
          P(rate ≤ {fmt(cut, 1)}) from {shaded} bars: <span className="font-semibold tabular" data-testid="tb-prob">{fmt(prob, 4)}</span> (exact {fmt(exact, 4)}). All {n} bars
          add up to <span className="font-semibold tabular" data-testid="tb-area">{fmt(area, 4)}</span>, and Σ x·f(x)·Δx gives the mean rate{" "}
          <span className="font-semibold tabular" data-testid="tb-mean">{fmt(mean, 4)}</span>.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="tb-n" label="Number of bars on [0, 1]" value={nIdx} min={0} max={BAR_COUNTS.length - 1} step={1} onChange={setNIdx} display={(i) => String(BAR_COUNTS[i])} />
        <Slider id="tb-cut" label="Cut-off rate" value={cut} min={0.1} max={0.6} step={0.1} onChange={(v) => setCut(Math.round(v * 10) / 10)} display={(v) => fmt(v, 1)} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`Beta(5, 15) density cut into ${n} bars; area left of ${fmt(cut, 1)} is ${fmt(prob, 4)}`}>
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="density" />
        <Axis scale={x} orient="bottom" at={B} label="conversion rate" />
        {Array.from({ length: visible }, (_, i) => {
          const h = endcap((i + 0.5) * dx);
          const on = i < shaded;
          return (
            <rect
              key={i}
              x={x(i * dx)}
              y={y(h)}
              width={Math.max(0.5, x(dx) - x(0) - (n <= 50 ? 1 : 0))}
              height={B - y(h)}
              fill={on ? "var(--series-1)" : "var(--seq-100)"}
              fillOpacity={on ? 0.75 : 1}
            />
          );
        })}
        <path d={xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(endcap(v)).toFixed(1)}`).join("")} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
        <line x1={x(cut)} x2={x(cut)} y1={12} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Bars counted: rate at or below the cut-off" shape="bar" />
        <Key color="var(--seq-100)" label="Bars above the cut-off" shape="bar" />
        <Key color="var(--ink)" label="The density curve" shape="line" />
      </div>
    </Panel>
  );
}

const BOX_H = 4.5;
const MC_MAX = 10000;

/** Throw random points into a box; the share landing under the curve, times the box's area, is the area. */
export function MonteCarloArea() {
  const [n, setN] = useState(100);
  const pts = useMemo(() => {
    const rng = mulberry32(12);
    return Array.from({ length: MC_MAX }, () => {
      const px = rng();
      return [px, rng() * BOX_H] as const;
    });
  }, []);
  const cut = 0.3;
  let hits = 0;
  for (let i = 0; i < n; i++) if (pts[i][0] <= cut && pts[i][1] <= endcap(pts[i][0])) hits++;
  const est = (hits / n) * BOX_H;
  const x = linear([0, 1], [L, VW - 14]);
  const y = linear([0, BOX_H], [B, 12]);
  const xs = Array.from({ length: 201 }, (_, i) => i * 0.005);
  const shown = Math.min(n, 2000);
  return (
    <Panel
      title="Area by random darts: no bars at all"
      footer={
        <>
          <span className="tabular" data-testid="mc-n">{n.toLocaleString("en-IN")}</span> darts, {hits.toLocaleString("en-IN")} under the curve left of 0.3. Estimate:{" "}
          {hits} ÷ {n.toLocaleString("en-IN")} × box area {BOX_H} = <span className="font-semibold tabular" data-testid="mc-est">{fmt(est, 4)}</span> (exact 0.7178).
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setN((v) => Math.min(MC_MAX, v + 900))} disabled={n >= MC_MAX} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white disabled:opacity-50">
          Throw 900 more
        </button>
        <button type="button" onClick={() => setN(MC_MAX)} disabled={n >= MC_MAX} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent disabled:opacity-50">
          Throw up to 10,000
        </button>
        <button type="button" onClick={() => setN(100)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
          Start over
        </button>
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`${n} random darts; estimated area ${fmt(est, 4)}`}>
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="density" />
        <Axis scale={x} orient="bottom" at={B} label="conversion rate" />
        {pts.slice(0, shown).map(([px, py], i) => {
          const hit = px <= cut && py <= endcap(px);
          return <circle key={i} cx={x(px)} cy={y(py)} r={1.6} fill={hit ? "var(--series-1)" : "var(--muted)"} fillOpacity={hit ? 0.9 : 0.35} />;
        })}
        <path d={xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(endcap(v)).toFixed(1)}`).join("")} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
        <line x1={x(cut)} x2={x(cut)} y1={12} y2={B} stroke="var(--ink)" strokeDasharray="4 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Dart under the curve, left of 0.3" />
        <Key color="var(--muted)" label="Any other dart" />
        {n > shown && <span className="text-xs text-ink-2">Showing the first 2,000 darts.</span>}
      </div>
    </Panel>
  );
}

// ---------- Vectors as baskets ----------

export const SKUS = ["paint", "brush", "tape", "drill", "bits"];
export const BASKET_A = [2, 1, 1, 0, 0];
export const BASKET_B = [1, 1, 0, 0, 0];
export const BASKET_C = [0, 0, 0, 1, 2];

/** Two baskets in a two-SKU world, drawn as arrows. */
export function BasketPlane() {
  const [p1, setP1] = useState(2);
  const [b1, setB1] = useState(1);
  const [p2, setP2] = useState(1);
  const [b2, setB2] = useState(1);
  const [contractor, setContractor] = useState(false);
  const u = [p1, b1];
  const v = contractor ? [6 * p2, 6 * b2] : [p2, b2];
  const d = dot(u, v);
  const c = cosine(u, v);
  const angle = (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  const lim = contractor ? 40 : 7;
  const S = 260;
  const s = linear([0, lim], [40, S - 14]);
  const sy = linear([0, lim], [S - 30, 14]);
  const arrow = (vec: number[], color: string, id: string) =>
    vec[0] === 0 && vec[1] === 0 ? null : <line x1={s(0)} y1={sy(0)} x2={s(vec[0])} y2={sy(vec[1])} stroke={color} strokeWidth={3} markerEnd={`url(#${id})`} />;
  return (
    <Panel
      title="Two baskets as arrows: paint along one axis, brushes along the other"
      footer={
        <>
          Dot product {u[0]}×{v[0]} + {u[1]}×{v[1]} = <span className="font-semibold tabular" data-testid="bp-dot">{d}</span>. Lengths {fmt(norm(u), 3)} and {fmt(norm(v), 3)}. Cosine{" "}
          <span className="font-semibold tabular" data-testid="bp-cos">{u.some(Boolean) && v.some(Boolean) ? fmt(c, 3) : "undefined"}</span>
          {u.some(Boolean) && v.some(Boolean) && <>, an angle of {fmt(angle, 1)}°</>}.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="bp-p1" label="Shopper 1: tins of paint" value={p1} min={0} max={6} step={1} onChange={setP1} />
        <Slider id="bp-b1" label="Shopper 1: brushes" value={b1} min={0} max={6} step={1} onChange={setB1} />
        <Slider id="bp-p2" label="Shopper 2: tins of paint" value={p2} min={0} max={6} step={1} onChange={setP2} />
        <Slider id="bp-b2" label="Shopper 2: brushes" value={b2} min={0} max={6} step={1} onChange={setB2} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={contractor} onChange={(e) => setContractor(e.target.checked)} data-testid="bp-contractor" /> Shopper 2 is a contractor: six times everything
      </label>
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto mt-3 h-auto w-full max-w-sm" role="img" aria-label={`Two basket arrows; cosine ${fmt(c, 3)}`}>
        <defs>
          {[
            ["bp-a1", "var(--series-1)"],
            ["bp-a2", "var(--series-2)"],
          ].map(([id, col]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0L10,5L0,10z" fill={col} />
            </marker>
          ))}
        </defs>
        <Axis scale={sy} orient="left" at={40} gridTo={S - 14} label="brushes" />
        <Axis scale={s} orient="bottom" at={S - 30} label="tins of paint" />
        {arrow(v, "var(--series-2)", "bp-a2")}
        {arrow(u, "var(--series-1)", "bp-a1")}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Shopper 1" shape="line" />
        <Key color="var(--series-2)" label="Shopper 2" shape="line" />
      </div>
    </Panel>
  );
}

export const SHOPPERS: Shopper[] = randomShoppers(1000, 5);
const QUERIES = [
  { name: "A: painter (2, 1, 1, 0, 0)", basket: BASKET_A, kind: "painter" },
  { name: "B: brush and paint (1, 1, 0, 0, 0)", basket: BASKET_B, kind: "painter" },
  { name: "C: driller (0, 0, 0, 1, 2)", basket: BASKET_C, kind: "driller" },
] as const;

/** Find the 10 most similar of 1,000 shoppers, by raw dot product and by cosine. */
export function BasketSearch() {
  const [q, setQ] = useState(0);
  const query = QUERIES[q];
  const byDot = topK(SHOPPERS, query.basket, 10, dot);
  const byCos = topK(SHOPPERS, query.basket, 10, cosine);
  const col = (list: Shopper[], name: string, id: string) => (
    <div>
      <div className="text-sm font-medium">{name}</div>
      <div className="mt-1 text-xs text-ink-2">
        Contractors in the top 10: <span className="font-semibold tabular text-ink" data-testid={`${id}-contractors`}>{list.filter((s) => s.contractor).length}</span>. Same kind of shopper:{" "}
        <span className="font-semibold tabular text-ink" data-testid={`${id}-same`}>{list.filter((s) => s.kind === query.kind).length}</span>.
      </div>
      <ol className="mt-2 space-y-1 text-xs tabular">
        {list.slice(0, 5).map((s, i) => (
          <li key={i} className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1">
            <span className="w-4 text-muted">{i + 1}</span>
            <span className="font-mono">({s.basket.join(", ")})</span>
            <span className="text-ink-2">
              {s.kind}
              {s.contractor ? ", contractor" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <Panel title="1,000 shoppers' baskets. Which ten are most like this one?" footer="Baskets list (paint, brush, tape, drill, bits). One shopper in five is a contractor who buys six times as much.">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Query basket">
        {QUERIES.map((qq, i) => (
          <button
            key={qq.name}
            type="button"
            role="radio"
            aria-checked={q === i}
            onClick={() => setQ(i)}
            className={q === i ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {qq.name}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {col(byDot, "Ranked by raw dot product", "bs-dot")}
        {col(byCos, "Ranked by cosine", "bs-cos")}
      </div>
    </Panel>
  );
}

// ---------- Matrices as store × SKU tables ----------

export const UNITS = [
  [40, 10, 2],
  [25, 20, 5],
  [10, 5, 8],
];
export const PRICES = [500, 150, 4000];
export const COSTS = [350, 90, 3000];
export const STORE_NAMES = ["Pune", "Indore", "Nagpur"];
export const ITEM_NAMES = ["Paint (litres)", "Brushes", "Drills"];

const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

/** Edit the units table or the prices and watch every store's revenue, cost and margin update. */
export function StoreTable() {
  const [units, setUnits] = useState(UNITS);
  const [prices, setPrices] = useState(PRICES);
  const [costs, setCosts] = useState(COSTS);
  const [row, setRow] = useState(0);
  const [showXtX, setShowXtX] = useState(false);
  const revenue = matVec(units, prices);
  const cost = matVec(units, costs);
  const totals = matVec(transpose(units), [1, 1, 1]);
  const gram = xtx(units);
  const cell = (v: number, set: (n: number) => void, label: string, testid?: string) => (
    <input
      type="number"
      min={0}
      value={v}
      aria-label={label}
      data-testid={testid}
      onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
      className="w-20 rounded-md border border-line bg-surface-1 px-1.5 py-0.5 text-right tabular"
    />
  );
  return (
    <Panel
      title="A store × SKU table times a price list: every store's revenue at once"
      footer={
        <>
          {STORE_NAMES[row]}&apos;s revenue is its row dotted with the prices:{" "}
          <span className="tabular">{units[row].map((u, j) => `${u} × ${prices[j]}`).join(" + ")}</span> ={" "}
          <span className="font-semibold tabular" data-testid="st-row">{inr(revenue[row])}</span>.
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead className="text-left text-xs text-ink-2">
            <tr>
              <th className="py-1 pr-2 font-medium">Store</th>
              {ITEM_NAMES.map((n) => (
                <th key={n} className="py-1 pr-2 font-medium">
                  {n}
                </th>
              ))}
              <th className="py-1 pr-2 font-medium">Revenue</th>
              <th className="py-1 pr-2 font-medium">Cost</th>
              <th className="py-1 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {units.map((r, i) => (
              <tr key={i} className={row === i ? "bg-accent-wash" : ""} onClick={() => setRow(i)}>
                <td className="border-t border-line py-1 pr-2">
                  <button type="button" onClick={() => setRow(i)} className="text-left font-medium hover:text-accent">
                    {STORE_NAMES[i]}
                  </button>
                </td>
                {r.map((u, j) =>
                  <td key={j} className="border-t border-line py-1 pr-2">
                    {cell(u, (n) => setUnits(units.map((rr, a) => (a === i ? rr.map((vv, b) => (b === j ? n : vv)) : rr))), `${STORE_NAMES[i]} ${ITEM_NAMES[j]}`, `st-u-${i}-${j}`)}
                  </td>,
                )}
                <td className="border-t border-line py-1 pr-2 font-semibold" data-testid={`st-rev-${i}`}>
                  {inr(revenue[i])}
                </td>
                <td className="border-t border-line py-1 pr-2">{inr(cost[i])}</td>
                <td className="border-t border-line py-1">{inr(revenue[i] - cost[i])}</td>
              </tr>
            ))}
            <tr className="text-ink-2">
              <td className="border-t border-line py-1 pr-2 text-xs">Price (₹)</td>
              {prices.map((p, j) => (
                <td key={j} className="border-t border-line py-1 pr-2">
                  {cell(p, (n) => setPrices(prices.map((v, b) => (b === j ? n : v))), `Price of ${ITEM_NAMES[j]}`, `st-p-${j}`)}
                </td>
              ))}
              <td className="border-t border-line py-1 pr-2 text-xs" colSpan={3}>
                Chain revenue <span className="font-semibold text-ink" data-testid="st-total">{inr(revenue.reduce((a, b) => a + b, 0))}</span>
              </td>
            </tr>
            <tr className="text-ink-2">
              <td className="py-1 pr-2 text-xs">Cost (₹)</td>
              {costs.map((p, j) => (
                <td key={j} className="py-1 pr-2">
                  {cell(p, (n) => setCosts(costs.map((v, b) => (b === j ? n : v))), `Cost of ${ITEM_NAMES[j]}`)}
                </td>
              ))}
              <td className="py-1 text-xs" colSpan={3}>
                Units per SKU (column totals): {totals.join(", ")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showXtX} onChange={(e) => setShowXtX(e.target.checked)} /> Show XᵀX: every pair of SKU columns dotted together
      </label>
      {showXtX && (
        <table className="mt-2 text-sm tabular" data-testid="st-xtx">
          <thead className="text-left text-xs text-ink-2">
            <tr>
              <th className="py-1 pr-3 font-medium" />
              {ITEM_NAMES.map((n) => (
                <th key={n} className="py-1 pr-3 font-medium">
                  {n.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gram.map((r, i) => (
              <tr key={i}>
                <td className="border-t border-line py-1 pr-3 text-xs text-ink-2">{ITEM_NAMES[i].split(" ")[0]}</td>
                {r.map((v, j) => (
                  <td key={j} className="border-t border-line py-1 pr-3">
                    {v.toLocaleString("en-IN")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** 1,000 random price scenarios multiplied through the same table in one go. */
export function PriceScenarios() {
  const [spread, setSpread] = useState(0.1);
  const res = useMemo(() => {
    const rng = mulberry32(21);
    const scen = Array.from({ length: 1000 }, () => PRICES.map((p) => p * (1 - spread + 2 * spread * rng())));
    // P is a 3 × 1000 table of prices (one column per scenario); revenue = UNITS · P.
    const chain = scen.map((p) => matVec(UNITS, p).reduce((a, b) => a + b, 0));
    const avgPrice = PRICES.map((_, j) => scen.reduce((s, p) => s + p[j], 0) / scen.length);
    return { chain, mean: chain.reduce((a, b) => a + b, 0) / chain.length, atMean: matVec(UNITS, avgPrice).reduce((a, b) => a + b, 0) };
  }, [spread]);
  const lo = 102750 * 0.7;
  const hi = 102750 * 1.3;
  const nb = 40;
  const counts = Array.from({ length: nb }, (_, k) => res.chain.filter((v) => v >= lo + ((hi - lo) * k) / nb && v < lo + ((hi - lo) * (k + 1)) / nb).length);
  const x = linear([lo, hi], [L, VW - 14]);
  const y = linear([0, Math.max(...counts) * 1.1], [B, 12]);
  return (
    <Panel
      title="1,000 price scenarios, one matrix product"
      footer={
        <>
          Average chain revenue over the scenarios: <span className="font-semibold tabular" data-testid="ps-mean">{inr(res.mean)}</span>. Revenue at the average prices:{" "}
          <span className="font-semibold tabular" data-testid="ps-atmean">{inr(res.atMean)}</span>. They match because a matrix product is linear.
        </>
      }
    >
      <Slider id="ps-spread" label="Each price moves at random by up to ±" value={spread} min={0.05} max={0.3} step={0.05} onChange={setSpread} display={(v) => `${Math.round(v * 100)}%`} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of chain revenue across 1,000 price scenarios">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="scenarios" />
        <Axis scale={x} orient="bottom" at={B} format={(v) => `₹${Math.round(v / 1000)}k`} tickValues={[80000, 90000, 100000, 110000, 120000, 130000]} label="chain revenue" />
        {counts.map((c, k) => (
          <rect key={k} x={x(lo + ((hi - lo) * k) / nb) + 0.5} y={y(c)} width={x(lo + (hi - lo) / nb) - x(lo) - 1} height={B - y(c)} fill="var(--seq-250)" />
        ))}
        <line x1={x(102750)} x2={x(102750)} y1={12} y2={B} stroke="var(--ink)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-250)" label="Scenarios" shape="bar" />
        <Key color="var(--ink)" label="Revenue at today's prices, ₹1,02,750" shape="line" />
      </div>
    </Panel>
  );
}

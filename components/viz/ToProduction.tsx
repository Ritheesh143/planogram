"use client";

import { useMemo, useState } from "react";
import {
  criticalRatio,
  DP,
  fitGlobal,
  GL,
  globalVsLocal,
  leadTimeP90,
  leadTimeSd,
  NV,
  orderOutcome,
  pmfArray,
  pmfQuantile,
  policyStudy,
  type Policy,
  quantile,
  type Regime,
  ruleService,
  samplePaths,
  SS,
} from "@/lib/sim/uncertainty";
import { Axis, Key, linear, Panel, Slider, ticks } from "./kit";

const VW = 460;
const H = 230;
const L = 44;
const B = H - 32;
const R = VW - 12;

function Radios<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={value === o.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// ---------- fc-deep ----------

/** The last five weeks before the forecast: only the last two feed the model. */
export const DP_HISTORY = [38, 41, 44, 52, 50];

export function deepPaths() {
  const g = fitGlobal();
  return samplePaths(g.coef, g.sd, DP.last, DP.scale, DP.horizon, DP.paths, DP.seed);
}

export function SamplePathFan() {
  const [lead, setLead] = useState(4);
  const paths = useMemo(() => deepPaths(), []);
  const band = useMemo(
    () => Array.from({ length: DP.horizon }, (_, h) => {
      const col = paths.map((p) => p[h]);
      return [0.05, 0.25, 0.5, 0.75, 0.95].map((q) => quantile(col, q));
    }),
    [paths],
  );
  const r = leadTimeP90(paths, lead);
  const nh = DP_HISTORY.length;
  const x = linear([-nh + 1, DP.horizon], [L, R]);
  const y = linear([0, 90], [B, 10]);
  const area = (lo: number, hi: number) =>
    path([[x(0), y(DP_HISTORY[nh - 1])], ...band.map((b, h): [number, number] => [x(h + 1), y(b[hi])]), ...band.map((b, h): [number, number] => [x(h + 1), y(b[lo])]).reverse(), [x(0), y(DP_HISTORY[nh - 1])]]) + "Z";
  return (
    <Panel
      title={`${DP.paths.toLocaleString("en-IN")} sample paths from one global model: each draw is fed back in as next week's input`}
      footer={
        <>
          Units to cover {lead} week{lead > 1 ? "s" : ""} of demand with 90% confidence: from the paths{" "}
          <span className="font-semibold tabular" data-testid="dp-paths">{r.paths.toFixed(1)}</span>; adding each week&apos;s own P90{" "}
          <span className="font-semibold tabular" data-testid="dp-sum">{r.sumOfQ.toFixed(1)}</span>; treating the weeks as independent{" "}
          <span className="font-semibold tabular" data-testid="dp-indep">{r.indep.toFixed(1)}</span>. Expected demand {r.mean.toFixed(1)}.
        </>
      }
    >
      <Slider id="dp-lead" label="Lead time (weeks to cover)" value={lead} min={1} max={DP.horizon} step={1} onChange={setLead} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Forecast fan from sample paths">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="units a week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[-4, -2, 0, 2, 4, 6, 8]} format={(v) => (v > 0 ? `+${v}` : String(v))} label="week (0 = now)" />
        <rect x={x(0.5)} width={x(lead + 0.5) - x(0.5)} y={10} height={B - 10} fill="var(--accent-wash)" />
        <path d={area(0, 4)} fill="var(--series-1)" opacity={0.2} />
        <path d={area(1, 3)} fill="var(--series-1)" opacity={0.35} />
        {paths.slice(0, 12).map((p, i) => (
          <path key={i} d={path([[x(0), y(DP_HISTORY[nh - 1])], ...p.map((v, h): [number, number] => [x(h + 1), y(v)])])} fill="none" stroke="var(--series-3)" strokeWidth={0.8} opacity={0.7} />
        ))}
        <path d={path([[x(0), y(DP_HISTORY[nh - 1])], ...band.map((b, h): [number, number] => [x(h + 1), y(b[2])])])} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <path d={path(DP_HISTORY.map((v, i) => [x(i - nh + 1), y(v)]))} fill="none" stroke="var(--ink)" strokeWidth={2} />
        {DP_HISTORY.map((v, i) => <circle key={i} cx={x(i - nh + 1)} cy={y(v)} r={3} fill="var(--ink)" />)}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="Sales so far" shape="line" />
        <Key color="var(--series-1)" label="Median, 50% and 90% bands" shape="line" />
        <Key color="var(--series-3)" label="A few sample paths" shape="line" />
        <Key color="var(--accent-wash)" label="Lead time" shape="bar" />
      </div>
    </Panel>
  );
}

export function globalRuns(regime: Regime) {
  return GL.histories.map((h) => ({ h, ...globalVsLocal(regime, h) }));
}

const GL_LINES = [
  { id: "global", name: "Global model, zero-shot", color: "var(--series-1)" },
  { id: "local", name: "Fitted to this series alone", color: "var(--series-2)" },
  { id: "mean", name: "History average", color: "var(--muted)" },
] as const;

export function GlobalLocal() {
  const [regime, setRegime] = useState<Regime>("like");
  const runs = useMemo(() => globalRuns(regime), [regime]);
  const x = linear([GL.histories[0], GL.histories[GL.histories.length - 1]], [L, R]);
  const y = linear([0, 0.25], [B, 10]);
  const at = (h: number) => runs.find((r) => r.h === h)!;
  return (
    <Panel
      title={`A model trained on ${GL.train} other series forecasts ${GL.test} new ones it has never seen, against a model fitted to each new series alone`}
      footer={
        <>
          Error as a share of each series&apos; level. With 8 weeks of history: global{" "}
          <span className="font-semibold tabular" data-testid="gl-global-8">{pct(at(8).global)}</span>, local{" "}
          <span className="font-semibold tabular" data-testid="gl-local-8">{pct(at(8).local)}</span>. With 52 weeks: global{" "}
          <span className="font-semibold tabular" data-testid="gl-global-52">{pct(at(52).global)}</span>, local{" "}
          <span className="font-semibold tabular" data-testid="gl-local-52">{pct(at(52).local)}</span>.
        </>
      }
    >
      <Radios
        label="New series"
        value={regime}
        options={[
          { id: "like", name: `Like the training set (φ = ${GL.phi})` },
          { id: "unlike", name: `Unlike it (φ = ${GL.unlikePhi})` },
        ]}
        onChange={setRegime}
      />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Forecast error against weeks of history">
        <Axis scale={y} orient="left" at={L} gridTo={R} format={(v) => `${Math.round(v * 100)}%`} label="error / level" />
        <Axis scale={x} orient="bottom" at={B} tickValues={GL.histories} label="weeks of history for the new series" />
        {GL_LINES.map((l) => (
          <g key={l.id}>
            <path d={path(runs.map((r) => [x(r.h), y(r[l.id])]))} fill="none" stroke={l.color} strokeWidth={2} />
            {runs.map((r) => <circle key={r.h} cx={x(r.h)} cy={y(r[l.id])} r={3.5} fill={l.color} />)}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {GL_LINES.map((l) => <Key key={l.id} color={l.color} label={l.name} shape="line" />)}
      </div>
    </Panel>
  );
}

// ---------- fc-safety-stock ----------

const money = (v: number) => `${v < 0 ? "−" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;

export function Newsvendor() {
  const [price, setPrice] = useState(NV.price);
  const [cost, setCost] = useState(NV.cost);
  const [salvage, setSalvage] = useState(NV.salvage);
  const pmf = useMemo(() => pmfArray(NV.mean, NV.k), []);
  const c = Math.min(cost, price - 10);
  const s = Math.min(salvage, c - 10);
  const cr = criticalRatio(price, c, s);
  const qStar = pmfQuantile(pmf, cr);
  const qs = Array.from({ length: 141 }, (_, i) => 40 + i);
  const profits = qs.map((q) => orderOutcome(q, pmf, price, c, s).profit);
  const best = orderOutcome(qStar, pmf, price, c, s);
  const atMean = orderOutcome(NV.mean, pmf, price, c, s);
  const x = linear([40, 180], [L, R]);
  const lo = Math.min(...profits);
  const hi = Math.max(...profits);
  const y = linear([Math.min(0, lo), hi * 1.08], [B, 10]);
  return (
    <Panel
      title="One buy of wreaths for the season: expected profit for every order size"
      footer={
        <>
          Short a wreath costs ₹{price - c} of margin; stuck with one costs ₹{c - s}. Critical ratio{" "}
          <span className="font-semibold tabular" data-testid="nv-cr">{cr.toFixed(3)}</span>, so order the {Math.round(cr * 100)}th percentile of demand:{" "}
          <span className="font-semibold tabular" data-testid="nv-q">{qStar}</span>, expected profit{" "}
          <span className="font-semibold tabular" data-testid="nv-profit">{money(best.profit)}</span>. Ordering the mean forecast ({NV.mean}) makes{" "}
          <span className="font-semibold tabular" data-testid="nv-mean-profit">{money(atMean.profit)}</span>.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider id="nv-price" label="Price" value={price} min={150} max={500} step={10} onChange={setPrice} display={(v) => `₹${v}`} />
        <Slider id="nv-cost" label="Cost" value={cost} min={50} max={300} step={10} onChange={setCost} display={(v) => `₹${v}`} />
        <Slider id="nv-salvage" label="Clearance price" value={salvage} min={0} max={100} step={10} onChange={setSalvage} display={(v) => `₹${v}`} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Expected profit against order quantity">
        <Axis scale={y} orient="left" at={L} gridTo={R} format={(v) => (v === 0 ? "0" : `${Math.round(v / 100) / 10}k`)} label="expected profit (₹)" />
        <Axis scale={x} orient="bottom" at={B} label="wreaths ordered" />
        <path d={path(qs.map((q, i) => [x(q), y(profits[i])]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <line x1={x(NV.mean)} x2={x(NV.mean)} y1={10} y2={B} stroke="var(--series-2)" strokeDasharray="4 3" strokeWidth={1.5} />
        <line x1={x(qStar)} x2={x(qStar)} y1={10} y2={B} stroke="var(--ink)" strokeWidth={1.5} />
        <circle cx={x(qStar)} cy={y(best.profit)} r={5} fill="var(--ink)" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Expected profit" shape="line" />
        <Key color="var(--ink)" label="Critical-ratio order" shape="line" />
        <Key color="var(--series-2)" label="Mean forecast" shape="line" />
      </div>
    </Panel>
  );
}

export function LeadTimeErrors() {
  const [lead, setLead] = useState(SS.L);
  const [rho, setRho] = useState(SS.rho);
  const rule = SS.sigma * Math.sqrt(lead);
  const truth = leadTimeSd(SS.sigma, lead, rho);
  const service = ruleService(lead, rho, SS.target);
  const rhos = Array.from({ length: 19 }, (_, i) => i * 0.05);
  const x = linear([0, 0.9], [L, R]);
  const y = linear([0.6, 1], [B, 10]);
  return (
    <Panel
      title="Safety stock set by z·σ·√L, when this week's forecast error predicts next week's"
      footer={
        <>
          σ√L says the {lead}-week error has sd <span className="font-semibold tabular" data-testid="lt-rule">{rule.toFixed(1)}</span>; with week-to-week correlation{" "}
          {rho.toFixed(1)} it is <span className="font-semibold tabular" data-testid="lt-true">{truth.toFixed(1)}</span>. A stock set for 95% service delivers{" "}
          <span className="font-semibold tabular" data-testid="lt-service">{pct(service)}</span>.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider id="lt-lead" label="Lead time L (weeks)" value={lead} min={1} max={8} step={1} onChange={setLead} />
        <Slider id="lt-rho" label="Error correlation between weeks ρ" value={rho} min={0} max={0.9} step={0.1} onChange={(v) => setRho(Number(v.toFixed(1)))} display={(v) => v.toFixed(1)} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Achieved service level against error correlation">
        <Axis scale={y} orient="left" at={L} gridTo={R} format={(v) => `${Math.round(v * 100)}%`} label="service delivered" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[0, 0.2, 0.4, 0.6, 0.8]} label="error correlation ρ" />
        <line x1={L} x2={R} y1={y(SS.target)} y2={y(SS.target)} stroke="var(--ink)" strokeDasharray="4 3" />
        <path d={path(rhos.map((r) => [x(r), y(ruleService(lead, r, SS.target))]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <circle cx={x(rho)} cy={y(service)} r={5} fill="var(--ink)" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Service from z·σ·√L" shape="line" />
        <Key color="var(--ink)" label="Promised 95%" shape="line" />
      </div>
    </Panel>
  );
}

export const POL_SALVAGE = [0, 0.25, 0.5, 0.75];
const POL_NAMES: Record<Policy, string> = { mean: "Order the mean", p95: "Blanket 95% service", cr: "Each SKU's critical ratio", crPoisson: "Critical ratio, Poisson spread" };

export function PolicyStudy() {
  const [si, setSi] = useState(1);
  const runs = useMemo(() => policyStudy(POL_SALVAGE[si]), [si]);
  const lo = Math.min(0, ...runs.map((r) => r.profit));
  const hi = Math.max(...runs.map((r) => r.profit));
  const x = linear([lo, hi], [200, R - 96]);
  const rowH = 38;
  const h = runs.length * rowH + 40;
  return (
    <Panel
      title="1,000 seasonal SKUs, one buy each: total expected profit under four ordering policies"
      footer={
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-ink-2">
                <th className="py-1 pr-3 font-medium">Policy</th>
                <th className="py-1 pr-3 font-medium">Units bought</th>
                <th className="py-1 pr-3 font-medium">Demand met</th>
                <th className="py-1 font-medium">Left over</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.policy} className="border-t border-line">
                  <td className="py-1 pr-3">{POL_NAMES[r.policy]}</td>
                  <td className="py-1 pr-3" data-testid={`pol-units-${r.policy}`}>{r.units.toLocaleString("en-IN")}</td>
                  <td className="py-1 pr-3" data-testid={`pol-fill-${r.policy}`}>{pct(r.fill)}</td>
                  <td className="py-1">{Math.round(r.left).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <Slider id="pol-salvage" label="Clearance recovers" value={si} min={0} max={POL_SALVAGE.length - 1} step={1} onChange={setSi} display={(i) => `${Math.round(POL_SALVAGE[i] * 100)}% of cost`} />
      <svg viewBox={`0 0 ${VW} ${h}`} className="mt-3 h-auto w-full" role="img" aria-label="Total expected profit by ordering policy">
        <line x1={x(0)} x2={x(0)} y1={8} y2={h - 26} stroke="var(--axis)" />
        {runs.map((r, i) => {
          const top = 12 + i * rowH;
          const x0 = x(Math.min(0, r.profit));
          const x1 = x(Math.max(0, r.profit));
          return (
            <g key={r.policy}>
              <text x={8} y={top + 17} fontSize={12} fill="var(--ink-2)">{POL_NAMES[r.policy]}</text>
              <rect x={x0} width={Math.max(x1 - x0, 1)} y={top + 4} height={20} rx={3} fill={r.profit < 0 ? "var(--critical)" : r.policy === "cr" ? "var(--series-1)" : "var(--muted)"} />
              <text
                x={x1 + 4}
                y={top + 18}
                fontSize={11}
                fill="var(--ink)"
                className="tabular"
                data-testid={`pol-profit-${r.policy}`}
              >
                {money(r.profit)}
              </text>
            </g>
          );
        })}
        <Axis scale={x} orient="bottom" at={h - 26} tickValues={ticks(lo, hi)} format={(v) => (v === 0 ? "0" : `₹${Math.round(v / 100000)}L`)} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Critical ratio per SKU" shape="bar" />
        <Key color="var(--critical)" label="Loses money" shape="bar" />
      </div>
    </Panel>
  );
}


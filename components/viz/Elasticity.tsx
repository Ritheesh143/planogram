"use client";

import { useMemo, useState } from "react";
import {
  bestPrice,
  CS,
  crossStudy,
  demandAt,
  EL,
  elasticityStudy,
  EP,
  PAINT,
  pointElasticity,
  profitAt,
  promoOutcome,
  type DemandShape,
} from "@/lib/sim/elasticity";
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
const rupees = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const money = (v: number) => `${v < 0 ? "−" : "+"}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;
const signed = (v: number, d = 2) => (v < 0 ? `−${Math.abs(v).toFixed(d)}` : v.toFixed(d));

// ---------- elasticity-derivative ----------

const PRICES = Array.from({ length: 41 }, (_, i) => 150 + i * 5);

export function DemandCurves() {
  const [axes, setAxes] = useState<"plain" | "log">("plain");
  const [price, setPrice] = useState(EL.p0);
  const log = axes === "log";
  const RX = R - 14;
  const x = log ? linear([Math.log(150), Math.log(350)], [L, RX]) : linear([150, 350], [L, RX]);
  const y = log ? linear([Math.log(10), Math.log(1500)], [B, 10]) : linear([0, 1200], [B, 10]);
  const X = (p: number) => x(log ? Math.log(p) : p);
  const Y = (q: number) => y(log ? Math.log(q) : q);
  const curve = (shape: DemandShape) => path(PRICES.filter((p) => !log || demandAt(shape, p) >= 10).map((p) => [X(p), Y(demandAt(shape, p))]));
  const pTicks = [150, 200, 250, 300, 350];
  const qTicks = log ? [10, 30, 100, 300, 1000] : ticks(0, 1200);
  const yp = linear([0, 30000], [B, 10]);
  const xp = linear([150, 350], [L, RX]);
  const best = { constant: bestPrice("constant"), line: bestPrice("line") };
  return (
    <Panel
      title="Two demand curves through the same two weeks of wood glue sales"
      footer={
        <>
          At ₹{price}: the constant-elasticity curve sells <span className="font-semibold tabular" data-testid="ed-q-const">{Math.round(demandAt("constant", price))}</span> with
          elasticity <span className="font-semibold tabular" data-testid="ed-el-const">{signed(pointElasticity("constant", price))}</span>; the straight line sells{" "}
          <span className="font-semibold tabular" data-testid="ed-q-line">{Math.round(demandAt("line", price))}</span> with elasticity{" "}
          <span className="font-semibold tabular" data-testid="ed-el-line">{demandAt("line", price) > 0 ? signed(pointElasticity("line", price)) : "−∞"}</span>. Best price at ₹{EL.cost}{" "}
          cost: <span className="font-semibold tabular" data-testid="ed-best-const">{rupees(best.constant)}</span> and{" "}
          <span className="font-semibold tabular" data-testid="ed-best-line">{rupees(best.line)}</span>.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Radios
          label="Axes"
          value={axes}
          options={[
            { id: "plain", name: "Plain axes" },
            { id: "log", name: "Log axes" },
          ]}
          onChange={setAxes}
        />
        <Slider id="ed-price" label="Price" value={price} min={150} max={350} step={5} onChange={setPrice} display={(v) => `₹${v}`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Units a week against price for both demand curves">
          <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={log ? qTicks.map(Math.log) : qTicks} format={(v) => String(Math.round(log ? Math.exp(v) : v))} label="bottles a week" />
          <Axis scale={x} orient="bottom" at={B} tickValues={log ? pTicks.map(Math.log) : pTicks} format={(v) => `₹${Math.round(log ? Math.exp(v) : v)}`} label="price" />
          <path d={curve("line")} fill="none" stroke="var(--series-2)" strokeWidth={2} />
          <path d={curve("constant")} fill="none" stroke="var(--series-1)" strokeWidth={2} />
          <line x1={X(price)} x2={X(price)} y1={10} y2={B} stroke="var(--muted)" strokeDasharray="4 3" />
          {[
            [EL.p0, EL.q0],
            [EL.p1, EL.q1],
          ].map(([p, q]) => (
            <circle key={p} cx={X(p)} cy={Y(q)} r={5} fill="var(--ink)" />
          ))}
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Weekly profit against price for both demand curves">
          <Axis scale={yp} orient="left" at={L} gridTo={R} format={(v) => (v === 0 ? "0" : `${v / 1000}k`)} label="profit a week (₹)" />
          <Axis scale={xp} orient="bottom" at={B} tickValues={pTicks} format={(v) => `₹${v}`} label="price" />
          {(["line", "constant"] as const).map((s) => (
            <g key={s}>
              <path d={path(PRICES.map((p) => [xp(p), yp(Math.max(0, profitAt(s, p)))]))} fill="none" stroke={s === "line" ? "var(--series-2)" : "var(--series-1)"} strokeWidth={2} />
              <circle cx={xp(best[s])} cy={yp(profitAt(s, best[s]))} r={4} fill={s === "line" ? "var(--series-2)" : "var(--series-1)"} />
            </g>
          ))}
          <line x1={xp(price)} x2={xp(price)} y1={10} y2={B} stroke="var(--muted)" strokeDasharray="4 3" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="The two weeks seen" />
        <Key color="var(--series-1)" label="Constant elasticity (−3)" shape="line" />
        <Key color="var(--series-2)" label="Straight line" shape="line" />
      </div>
    </Panel>
  );
}

const EP_LO = -9;
const EP_HI = 3;
const EP_BW = 0.25;

export function ElasticityPrecision() {
  const [si, setSi] = useState(0);
  const [wi, setWi] = useState(2);
  const s = EP.sds[si];
  const weeks = EP.weeks[wi];
  const study = useMemo(() => elasticityStudy(s, weeks), [s, weeks]);
  const bins = Math.round((EP_HI - EP_LO) / EP_BW);
  const counts = new Array<number>(bins).fill(0);
  for (const e of study.estimates) counts[Math.max(0, Math.min(bins - 1, Math.floor((e - EP_LO) / EP_BW)))]++;
  const x = linear([EP_LO, EP_HI], [L, R]);
  const y = linear([0, Math.max(...counts) / EP.reps * 1.1], [B, 10]);
  return (
    <Panel
      title={`Rerun ${EP.reps.toLocaleString("en-IN")} times: the elasticity a log-log regression finds, when the truth is −3`}
      footer={
        <>
          Estimates spread with sd <span className="font-semibold tabular" data-testid="ep-sd">{study.sd.toFixed(2)}</span>.{" "}
          <span className="font-semibold tabular" data-testid="ep-close">{pct(study.close, 0)}</span> land within 0.5 of the truth, and{" "}
          <span className="font-semibold tabular" data-testid="ep-inelastic">{pct(study.inelastic)}</span> come out above −1, which says &ldquo;raise the price as far as you like&rdquo;.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider id="ep-move" label="Typical week-to-week price move" value={si} min={0} max={EP.sds.length - 1} step={1} onChange={setSi} display={(i) => `±${Math.round(EP.sds[i] * 100)}%`} />
        <Slider id="ep-weeks" label="Weeks of history" value={wi} min={0} max={EP.weeks.length - 1} step={1} onChange={setWi} display={(i) => String(EP.weeks[i])} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of estimated elasticities">
        <rect x={x(-1)} y={10} width={R - x(-1)} height={B - 10} fill="var(--accent-wash)" />
        <Axis scale={y} orient="left" at={L} gridTo={R} format={(v) => `${Math.round(v * 100)}%`} label="share of reruns" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[-9, -7, -5, -3, -1, 1, 3]} format={(v) => signed(v, 0)} label="estimated elasticity" />
        {counts.map((c, i) => (
          <rect key={i} x={x(EP_LO + i * EP_BW) + 0.5} width={x(EP_BW) - x(0) - 1} y={y(c / EP.reps)} height={B - y(c / EP.reps)} fill="var(--series-1)" />
        ))}
        <line x1={x(EP.eps)} x2={x(EP.eps)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" strokeWidth={1.5} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Estimates (ends hold everything beyond)" shape="bar" />
        <Key color="var(--ink)" label="Truth −3" shape="line" />
        <Key color="var(--accent-wash)" label="Above −1: looks inelastic" shape="bar" />
      </div>
    </Panel>
  );
}

// ---------- cx-cross-elasticity ----------

export function CrossPromo() {
  const [promoted, setPromoted] = useState(0);
  const [depth, setDepth] = useState(0.2);
  const o = promoOutcome(promoted, depth);
  const max = Math.max(700, ...o.units);
  const x = linear([-0.5, PAINT.length - 0.5], [L, R]);
  const y = linear([0, max], [B, 10]);
  const w = (x(1) - x(0)) * 0.34;
  return (
    <Panel
      title="One product on promotion: what happens to the whole paint bay"
      footer={
        <>
          {PAINT[promoted].name} gains <span className="font-semibold tabular" data-testid="xe-item">{Math.round(o.itemLift)}</span> tins a week; paint as a whole gains{" "}
          <span className="font-semibold tabular" data-testid="xe-cat">{Math.round(o.categoryLift)}</span>, because{" "}
          <span className="font-semibold tabular" data-testid="xe-can">{Math.round(o.cannibalized)}</span> came from the other paints. Rollers gain{" "}
          <span className="font-semibold tabular" data-testid="xe-halo">{Math.round(o.halo)}</span>. Margin: the item report says{" "}
          <span className="font-semibold tabular" data-testid="xe-item-margin">{money(o.itemMargin)}</span>, the bay makes{" "}
          <span className="font-semibold tabular" data-testid="xe-total-margin">{money(o.totalMargin)}</span>.{" "}
          {o.vendorFunded ? `${PAINT[promoted].name} pays for its discount.` : "Bolt & Beam pays for its own label's discount."}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Radios label="Promoted product" value={promoted} options={PAINT.slice(0, 3).map((p, i) => ({ id: i, name: p.name }))} onChange={setPromoted} />
        <Slider id="xe-depth" label="Discount" value={depth} min={0} max={0.4} step={0.05} onChange={(v) => setDepth(Number(v.toFixed(2)))} display={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Weekly units for each product before and during the promotion">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="units a week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={PAINT.map((_, i) => i)} format={(i) => PAINT[i].name} />
        {PAINT.map((p, i) => (
          <g key={p.id}>
            <rect x={x(i) - w - 1} width={w} y={y(p.base)} height={B - y(p.base)} fill="var(--seq-100)" />
            <rect x={x(i) + 1} width={w} y={y(o.units[i])} height={B - y(o.units[i])} fill={o.units[i] >= p.base - 0.5 ? "var(--series-1)" : "var(--critical)"} />
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-100)" label="Normal week" shape="bar" />
        <Key color="var(--series-1)" label="Promo week: gained" shape="bar" />
        <Key color="var(--critical)" label="Promo week: lost" shape="bar" />
      </div>
    </Panel>
  );
}

const CS_LO = -2;
const CS_HI = 4;
const CS_BW = 0.2;

export function CrossStudy() {
  const [oi, setOi] = useState(0);
  const overlap = CS.overlaps[oi];
  const s = useMemo(() => crossStudy(overlap), [overlap]);
  const bins = Math.round((CS_HI - CS_LO) / CS_BW);
  const counts = new Array<number>(bins).fill(0);
  for (const e of s.estimates) counts[Math.max(0, Math.min(bins - 1, Math.floor((e - CS_LO) / CS_BW)))]++;
  const x = linear([CS_LO, CS_HI], [L, R]);
  const y = linear([0, 0.3], [B, 10]);
  return (
    <Panel
      title={`Two years of weeks, rerun ${CS.reps} times: Lumen's cross-elasticity to Kestrel's price, estimated by regression (truth +1.0)`}
      footer={
        <>
          Estimates spread with sd <span className="font-semibold tabular" data-testid="cs-sd">{s.sd.toFixed(2)}</span>;{" "}
          <span className="font-semibold tabular" data-testid="cs-far">{pct(s.far, 0)}</span> are off by more than 0.5 and{" "}
          <span className="font-semibold tabular" data-testid="cs-wrong">{pct(s.wrongSign)}</span> have the wrong sign, making Lumen look like a complement.{" "}
          {s.unusable > 0 ? (
            <>
              In <span className="font-semibold tabular" data-testid="cs-unusable">{s.unusable}</span> reruns the brands were never on promo apart, so there was nothing to estimate.
            </>
          ) : null}
        </>
      }
    >
      <Slider id="cs-overlap" label="Kestrel promo weeks when Lumen is on promo too" value={oi} min={0} max={CS.overlaps.length - 1} step={1} onChange={setOi} display={(i) => `${Math.round(CS.overlaps[i] * 100)}%`} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Histogram of estimated cross-elasticities">
        <rect x={L} y={10} width={x(0) - L} height={B - 10} fill="var(--accent-wash)" />
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 0.1, 0.2, 0.3]} format={(v) => `${Math.round(v * 100)}%`} label="share of reruns" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[-2, -1, 0, 1, 2, 3, 4]} format={(v) => (v > 0 ? `+${v}` : signed(v, 0))} label="estimated cross-elasticity" />
        {counts.map((c, i) => (
          <rect key={i} x={x(CS_LO + i * CS_BW) + 0.5} width={x(CS_BW) - x(0) - 1} y={y(Math.min(0.3, c / CS.reps))} height={B - y(Math.min(0.3, c / CS.reps))} fill="var(--series-1)" />
        ))}
        <line x1={x(s.truth)} x2={x(s.truth)} y1={10} y2={B} stroke="var(--ink)" strokeDasharray="4 3" strokeWidth={1.5} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Estimates" shape="bar" />
        <Key color="var(--ink)" label="Truth +1.0" shape="line" />
        <Key color="var(--accent-wash)" label="Wrong sign: looks like a complement" shape="bar" />
      </div>
    </Panel>
  );
}

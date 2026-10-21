"use client";

import { useMemo, useState } from "react";
import { DRILL, drillShares, EN, endogeneityWeeks, HE, hierStudy, mean, randomUtilityStudy, type Lineup } from "@/lib/sim/elasticity";
import { Axis, Key, linear, Panel, Slider } from "./kit";

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

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const signed = (v: number, d = 2) => (v < 0 ? `−${Math.abs(v).toFixed(d)}` : v.toFixed(d));

// ---------- cx-mnl ----------

export function ChoiceShares() {
  const [lineup, setLineup] = useState<Lineup>("three");
  const [own, setOwn] = useState(DRILL.prices[1]);
  const [lambda, setLambda] = useState(1);
  const s = drillShares(lineup, own, lineup === "red" ? lambda : 1);
  const plain = drillShares(lineup, own, 1);
  const x = linear([-0.5, s.names.length - 0.5], [L, R]);
  const y = linear([0, 0.6], [B, 10]);
  const w = (x(1) - x(0)) * 0.55;
  const short = (n: string) => n.replace(" 20V", "").replace("-label 18V", " label").replace(" 12V", "");
  return (
    <Panel
      title={`${DRILL.shoppers} shoppers at the drill bay each choose the option with the highest utility (plus noise)`}
      footer={
        <>
          Kestrel{lineup === "red" ? " (both colors)" : ""} <span className="font-semibold tabular" data-testid="ch-kestrel">{pct(s.kestrel)}</span>, own label{" "}
          <span className="font-semibold tabular" data-testid="ch-own">{pct(s.own)}</span>, budget <span className="font-semibold tabular" data-testid="ch-budget">{pct(s.budget)}</span>,
          no drill <span className="font-semibold tabular" data-testid="ch-none">{pct(s.none)}</span>
          {lineup === "red" && lambda < 1 ? <> (plain logit: no drill {pct(plain.none)})</> : null}.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Radios
          label="Line-up"
          value={lineup}
          options={[
            { id: "three", name: "Three drills" },
            { id: "stockout", name: "Kestrel out of stock" },
            { id: "red", name: "Add a red Kestrel" },
          ]}
          onChange={setLineup}
        />
        <div className="grid gap-3">
          <Slider id="ch-price" label="Own-label price" value={own} min={2000} max={4500} step={250} onChange={setOwn} display={(v) => `₹${v.toLocaleString("en-IN")}`} />
          {lineup === "red" && (
            <Slider id="ch-lambda" label="Nest λ (1 = plain logit, near 0 = identical twins)" value={lambda} min={0.05} max={1} step={0.05} onChange={(v) => setLambda(Number(v.toFixed(2)))} display={(v) => v.toFixed(2)} />
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Share of shoppers choosing each option">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 0.2, 0.4, 0.6]} format={(v) => `${Math.round(v * 100)}%`} label="share of shoppers" />
        <Axis scale={x} orient="bottom" at={B} tickValues={s.names.map((_, i) => i)} format={(i) => short(s.names[i])} />
        {s.shares.map((v, i) => (
          <g key={s.names[i]}>
            <rect x={x(i) - w / 2} width={w} y={y(v)} height={B - y(v)} fill={s.names[i] === "No drill" ? "var(--seq-100)" : "var(--series-1)"} />
            {lineup === "red" && lambda < 1 && <line x1={x(i) - w / 2} x2={x(i) + w / 2} y1={y(plain.shares[i])} y2={y(plain.shares[i])} stroke="var(--ink)" strokeWidth={2} />}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Drills" shape="bar" />
        <Key color="var(--seq-100)" label="Walks away without one" shape="bar" />
        {lineup === "red" && lambda < 1 && <Key color="var(--ink)" label="Plain logit (λ = 1)" shape="line" />}
      </div>
    </Panel>
  );
}

const RU_NS = [100, 1000, 10000, 100000];

export function RandomUtility() {
  const [ni, setNi] = useState(1);
  const [noise, setNoise] = useState<"gumbel" | "normal">("gumbel");
  const n = RU_NS[ni];
  const s = useMemo(() => randomUtilityStudy(n, noise), [n, noise]);
  const names = ["Kestrel", "Own label", "Budget", "No drill"];
  const x = linear([-0.5, names.length - 0.5], [L, R]);
  const y = linear([0, 0.6], [B, 10]);
  const w = (x(1) - x(0)) * 0.55;
  return (
    <Panel
      title="Simulated shoppers: utility = value + random noise, pick the biggest"
      footer={
        <>
          {n.toLocaleString("en-IN")} shoppers chose Kestrel <span className="font-semibold tabular" data-testid="ru-0">{pct(s.sim[0])}</span>, own label{" "}
          <span className="font-semibold tabular" data-testid="ru-1">{pct(s.sim[1])}</span>, budget <span className="font-semibold tabular" data-testid="ru-2">{pct(s.sim[2])}</span>, no
          drill <span className="font-semibold tabular" data-testid="ru-3">{pct(s.sim[3])}</span>. The softmax formula says 50 / 25 / 12.5 / 12.5; the biggest gap is{" "}
          <span className="font-semibold tabular" data-testid="ru-gap">{(s.gap * 100).toFixed(1)}</span> points.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Radios
          label="Noise"
          value={noise}
          options={[
            { id: "gumbel", name: "Gumbel noise" },
            { id: "normal", name: "Normal noise" },
          ]}
          onChange={setNoise}
        />
        <Slider id="ru-n" label="Shoppers" value={ni} min={0} max={RU_NS.length - 1} step={1} onChange={setNi} display={(i) => RU_NS[i].toLocaleString("en-IN")} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Simulated choice shares against the softmax formula">
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[0, 0.2, 0.4, 0.6]} format={(v) => `${Math.round(v * 100)}%`} label="share of shoppers" />
        <Axis scale={x} orient="bottom" at={B} tickValues={names.map((_, i) => i)} format={(i) => names[i]} />
        {s.sim.map((v, i) => (
          <g key={names[i]}>
            <rect x={x(i) - w / 2} width={w} y={y(v)} height={B - y(v)} fill="var(--series-1)" />
            <line x1={x(i) - w / 2 - 4} x2={x(i) + w / 2 + 4} y1={y(s.formula[i])} y2={y(s.formula[i])} stroke="var(--ink)" strokeWidth={2} />
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Simulated shoppers" shape="bar" />
        <Key color="var(--ink)" label="Softmax formula" shape="line" />
      </div>
    </Panel>
  );
}

// ---------- cx-endogeneity ----------

export function EndogeneityScatter() {
  const [ki, setKi] = useState(0);
  const kappa = EN.kappas[ki];
  const d = useMemo(() => endogeneityWeeks(kappa), [kappa]);
  const x = linear([Math.log(600), Math.log(1700)], [L, R]);
  const y = linear([Math.log(25), Math.log(400)], [B, 10]);
  const mx = mean(d.lp);
  const my = mean(d.lq);
  const line = (slope: number) => {
    const [a, b] = [Math.log(600), Math.log(1700)];
    return { x1: x(a), x2: x(b), y1: y(my + slope * (a - mx)), y2: y(my + slope * (b - mx)) };
  };
  const inside = (i: number) => d.lq[i] > Math.log(25) && d.lq[i] < Math.log(400) && d.lp[i] > Math.log(600) && d.lp[i] < Math.log(1700);
  return (
    <Panel
      title={`${EN.weeks} weeks of garden hose sales. True elasticity −2; the manager raises the price in busy weeks`}
      footer={
        <>
          A regression of log sales on log price finds <span className="font-semibold tabular" data-testid="en-naive">{signed(d.naive)}</span>. Using only the price moves caused by
          supplier costs (an instrument) finds <span className="font-semibold tabular" data-testid="en-iv">{signed(d.iv)}</span>.
        </>
      }
    >
      <Slider id="en-kappa" label="How strongly price follows demand (κ)" value={ki} min={0} max={EN.kappas.length - 1} step={1} onChange={setKi} display={(i) => EN.kappas[i].toFixed(1)} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Weekly price against units sold, log axes">
        <defs>
          <clipPath id="en-clip">
            <rect x={L} y={10} width={R - L} height={B - 10} />
          </clipPath>
        </defs>
        <Axis scale={y} orient="left" at={L} gridTo={R} tickValues={[25, 50, 100, 200, 400].map(Math.log)} format={(v) => String(Math.round(Math.exp(v)))} label="hoses a week" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[600, 800, 1000, 1250, 1600].map(Math.log)} format={(v) => `₹${Math.round(Math.exp(v)).toLocaleString("en-IN")}`} label="price" />
        {d.lp.map((p, i) =>
          inside(i) ? <circle key={i} cx={x(p)} cy={y(d.lq[i])} r={3.5} fill={d.shock[i] > 0 ? "var(--series-1)" : "var(--series-2)"} fillOpacity={0.8} /> : null,
        )}
        <g clipPath="url(#en-clip)">
          <line {...line(d.naive)} stroke="var(--ink)" strokeWidth={2} />
          <line {...line(EN.eps)} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="5 4" />
        </g>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Busy weeks" />
        <Key color="var(--series-2)" label="Quiet weeks" />
        <Key color="var(--ink)" label="Regression line (solid), true slope −2 (dashed)" shape="line" />
      </div>
    </Panel>
  );
}

export function PooledElasticities() {
  const [wi, setWi] = useState(0);
  const weeks = HE.weeks[wi];
  const s = useMemo(() => hierStudy(weeks), [weeks]);
  const x = linear([-7, 3], [L, R]);
  const clip = (v: number) => x(Math.max(-7, Math.min(3, v)));
  const rows = { raw: 40, pooled: 110, truth: 180 };
  return (
    <Panel
      title={`${HE.skus} paint SKUs, each with its own elasticity: estimated alone, and partially pooled toward the category`}
      footer={
        <>
          Alone: error (RMSE) <span className="font-semibold tabular" data-testid="he-rmse-raw">{s.rmseRaw.toFixed(2)}</span>,{" "}
          <span className="font-semibold tabular" data-testid="he-inel-raw">{s.inelasticRaw}</span> SKUs look inelastic (above −1) and{" "}
          <span className="font-semibold tabular" data-testid="he-pos-raw">{s.positiveRaw}</span> have a positive elasticity. Pooled toward the category mean{" "}
          <span className="font-semibold tabular" data-testid="he-mu">{signed(s.mu)}</span> (spread <span className="font-semibold tabular" data-testid="he-tau">{s.tau.toFixed(2)}</span>
          ): error <span className="font-semibold tabular" data-testid="he-rmse-pooled">{s.rmsePooled.toFixed(2)}</span>,{" "}
          <span className="font-semibold tabular" data-testid="he-inel-pooled">{s.inelasticPooled}</span> look inelastic. Truly inelastic: {s.inelasticTrue}.
        </>
      }
    >
      <Slider id="he-weeks" label="Weeks of history per SKU" value={wi} min={0} max={HE.weeks.length - 1} step={1} onChange={setWi} display={(i) => String(HE.weeks[i])} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Each SKU's elasticity estimated alone, pooled, and the truth">
        <rect x={x(-1)} y={14} width={R - x(-1)} height={B - 14} fill="var(--accent-wash)" />
        <Axis scale={x} orient="bottom" at={B} tickValues={[-7, -5, -3, -1, 1, 3]} format={(v) => signed(v, 0)} label="elasticity" />
        {(Object.entries(rows) as [keyof typeof rows, number][]).map(([k, yy]) => (
          <text key={k} x={L} y={yy - 12} fontSize={11} fill="var(--ink-2)">
            {k === "raw" ? "Each SKU alone" : k === "pooled" ? "Partially pooled" : "Truth"}
          </text>
        ))}
        {s.raw.map((v, i) => (
          <g key={i}>
            <line x1={clip(v)} x2={clip(s.pooled[i])} y1={rows.raw} y2={rows.pooled} stroke="var(--muted)" strokeOpacity={0.35} />
            <line x1={clip(s.pooled[i])} x2={clip(s.truth[i])} y1={rows.pooled} y2={rows.truth} stroke="var(--muted)" strokeOpacity={0.2} />
            <circle cx={clip(v)} cy={rows.raw} r={3} fill="var(--series-2)" />
            <circle cx={clip(s.pooled[i])} cy={rows.pooled} r={3} fill="var(--series-1)" />
            <circle cx={clip(s.truth[i])} cy={rows.truth} r={3} fill="var(--ink)" />
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-2)" label="Alone (clipped at the edges)" />
        <Key color="var(--series-1)" label="Pooled" />
        <Key color="var(--ink)" label="True elasticity" />
        <Key color="var(--accent-wash)" label="Above −1: looks inelastic" shape="bar" />
      </div>
    </Panel>
  );
}

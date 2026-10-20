"use client";

import { useEffect, useMemo, useState } from "react";
import { betaInterval, betaPdf } from "@/lib/sim/bayes";
import {
  avg,
  avgJump,
  bag,
  bagStudy,
  diagChains,
  essChains,
  ess,
  hmcRun,
  HMC_RHO,
  logEndcap,
  metropolis,
  quantile,
  rhat,
  rwRun,
  share,
  stepStudy,
  type DiagScenario,
} from "@/lib/sim/mcmc";
import { mulberry32 } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 230;
const L = 44;
const B = H - 32;
const R = VW - 12;

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

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

/** Histogram bars (as densities) with the exact Beta(5, 15) curve on top. */
function BetaHistogram({ draws, cut, label }: { draws: number[]; cut?: number; label: string }) {
  const bins = 35;
  const top = 0.7;
  const w = top / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const d of draws) if (d < top) counts[Math.floor(d / w)]++;
  const dens = counts.map((c) => c / (draws.length * w));
  const x = linear([0, top], [L, R]);
  const y = linear([0, 6.5], [B, 10]);
  const curve = Array.from({ length: 141 }, (_, i) => (i / 140) * top)
    .map((t) => `${x(t).toFixed(1)},${y(Math.min(betaPdf(t, 5, 15), 6.5)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <Axis scale={y} orient="left" at={L} gridTo={R} label="density" />
      <Axis scale={x} orient="bottom" at={B} label="endcap conversion rate" />
      {dens.map((d, i) => (
        <rect
          key={i}
          x={x(i * w) + 0.5}
          y={y(Math.min(d, 6.5))}
          width={Math.max(x(w) - x(0) - 1, 0)}
          height={B - y(Math.min(d, 6.5))}
          fill={cut !== undefined && i * w >= cut - 1e-9 ? "var(--series-2)" : "var(--seq-250)"}
        />
      ))}
      <polyline points={curve} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
      {cut !== undefined && <line x1={x(cut)} x2={x(cut)} y1={10} y2={B} stroke="var(--ink-2)" strokeDasharray="4 3" />}
    </svg>
  );
}

// ---------- Rung 10 ----------

const BAG_SIZES = [10, 50, 100, 250, 500, 1000, 2000, 4000];
export const BAG_SEED = 16;

export function SampleBag() {
  const all = useMemo(() => bag(4000, BAG_SEED), []);
  const [i, setI] = useState(0);
  const n = BAG_SIZES[i];
  const draws = all.slice(0, n);
  const [elo, ehi] = betaInterval(5, 15);
  return (
    <Panel
      title="A bag of plausible conversion rates, drawn from the posterior Beta(5, 15)"
      footer={
        <>
          From <span className="font-semibold tabular">{n.toLocaleString("en-IN")}</span> draws: mean{" "}
          <span className="font-semibold tabular" data-testid="bag-mean">{draws.length ? avg(draws).toFixed(3) : "–"}</span> (exact 0.250); share above 0.3{" "}
          <span className="font-semibold tabular" data-testid="bag-p">{share(draws, (d) => d > 0.3).toFixed(3)}</span> (exact 0.282); middle 90% from{" "}
          <span className="font-semibold tabular" data-testid="bag-lo">{quantile(draws, 0.05).toFixed(3)}</span> to{" "}
          <span className="font-semibold tabular" data-testid="bag-hi">{quantile(draws, 0.95).toFixed(3)}</span> (exact {elo.toFixed(3)} to {ehi.toFixed(3)}).
        </>
      }
    >
      <Slider id="bag-size" label="Draws in the bag" value={i} min={0} max={BAG_SIZES.length - 1} step={1} onChange={setI} display={(v) => BAG_SIZES[v].toLocaleString("en-IN")} />
      <div className="mt-3">
        <BetaHistogram draws={draws} cut={0.3} label={`Histogram of ${n} posterior draws against the exact curve`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--seq-250)" label="Draws at or below 0.3" shape="bar" />
        <Key color="var(--series-2)" label="Draws above 0.3 (count these)" shape="bar" />
        <Key color="var(--ink)" label="Exact posterior curve" shape="line" />
      </div>
    </Panel>
  );
}

export const STUDY_SIZES = [10, 100, 1000, 4000];

export function BagStudy() {
  const study = useMemo(() => bagStudy(STUDY_SIZES, 200, 7), []);
  const x = linear([-0.5, STUDY_SIZES.length - 0.5], [L, R]);
  const y = linear([0, 0.8], [B, 10]);
  const exact = 0.2822;
  return (
    <Panel
      title="200 bags at each size: how far does the estimate of P(rate > 0.3) wander?"
      footer={
        <>
          Spread (sd) of the 200 estimates:{" "}
          {study.map((s, k) => (
            <span key={s.n}>
              {k > 0 && ", "}
              {s.n.toLocaleString("en-IN")} draws <span className="font-semibold tabular" data-testid={`bag-spread-${s.n}`}>{s.spread.toFixed(4)}</span>
            </span>
          ))}
          . Each 10× more draws shrinks it about √10 ≈ 3.2×.
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Estimates of P(rate above 0.3) for bags of 10, 100, 1,000 and 4,000 draws">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="estimate" />
        <Axis scale={x} orient="bottom" at={B} tickValues={STUDY_SIZES.map((_, k) => k)} format={(v) => `${STUDY_SIZES[v].toLocaleString("en-IN")} draws`} />
        <line x1={L} x2={R} y1={y(exact)} y2={y(exact)} stroke="var(--ink)" strokeDasharray="4 3" />
        {study.map((s, k) =>
          s.est.map((e, j) => {
            const jitter = (((j * 7919) % 200) / 200 - 0.5) * 0.6;
            return <circle key={`${k}-${j}`} cx={x(k + jitter)} cy={y(e)} r={2} fill="var(--series-1)" opacity={0.45} />;
          }),
        )}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="One bag's estimate" />
        <Key color="var(--ink)" label="Exact answer, 0.282" shape="line" />
      </div>
    </Panel>
  );
}

// ---------- Rung 11 ----------

export const MW_SEED = 3;
export const MW_STEPS = 4000;
export const MW_WARMUP = 500;

export function MetropolisWalker() {
  const [step, setStep] = useState(0.3);
  const chain = useMemo(() => metropolis(logEndcap, 0.5, step, MW_STEPS, mulberry32(MW_SEED)), [step]);
  const [k, setK] = useState(MW_STEPS);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setK((v) => {
        const next = Math.min(MW_STEPS, v + (v < 50 ? 1 : 40));
        if (next >= MW_STEPS) setPlaying(false);
        return next;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [playing]);
  const shown = chain.draws.slice(0, k);
  const kept = shown.slice(MW_WARMUP);
  let accepted = 0;
  for (let i = 0; i < shown.length; i++) if (shown[i] !== (i === 0 ? 0.5 : shown[i - 1])) accepted++;
  const accRate = k > 0 ? accepted / k : 0;
  const e = useMemo(() => (playing || k - MW_WARMUP < 50 ? null : ess(chain.draws.slice(MW_WARMUP, k))), [playing, k, chain]);
  const tx = linear([0, MW_STEPS], [L, R]);
  const ty = linear([0, 1], [B, 10]);
  const every = Math.max(1, Math.floor(shown.length / 800));
  const trace = shown
    .filter((_, i) => i % every === 0 || i === shown.length - 1)
    .map((v, j) => `${tx(Math.min(j * every, shown.length - 1)).toFixed(1)},${ty(v).toFixed(1)}`)
    .join(" ");
  return (
    <Panel
      title="The Metropolis walker on the endcap posterior, starting at 0.5"
      footer={
        <>
          Acceptance rate <span className="font-semibold tabular" data-testid="mw-accept">{pct(accRate)}</span>. After discarding the first {MW_WARMUP} steps as warm-up: mean{" "}
          <span className="font-semibold tabular" data-testid="mw-mean">{kept.length ? avg(kept).toFixed(3) : "–"}</span> (exact 0.250), effective sample size{" "}
          <span className="font-semibold tabular" data-testid="mw-ess">{e === null ? "–" : Math.round(e).toLocaleString("en-IN")}</span> out of {Math.max(kept.length, 0).toLocaleString("en-IN")} draws.
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Radios
          label="Step size"
          value={step}
          onChange={(v) => {
            setStep(v);
            setPlaying(false);
            setK(MW_STEPS);
          }}
          options={[
            { id: 0.01, name: "Tiny steps (0.01)" },
            { id: 0.3, name: "Medium steps (0.3)" },
            { id: 3, name: "Giant steps (3)" },
          ]}
        />
        <button
          type="button"
          onClick={() => {
            setK(1);
            setPlaying(true);
          }}
          className="rounded-lg border border-line px-3 py-1 text-sm"
        >
          {playing ? "Walking…" : "Replay the walk ▶"}
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Trace of the walker's position at each step">
        <rect x={L} y={10} width={tx(MW_WARMUP) - L} height={B - 10} fill="var(--neutral-mid)" />
        <Axis scale={ty} orient="left" at={L} gridTo={R} label="position θ" />
        <Axis scale={tx} orient="bottom" at={B} label="step" />
        <polyline points={trace} fill="none" stroke="var(--series-1)" strokeWidth={1} />
        <text x={L + 4} y={22} fontSize={11} fill="var(--ink-2)">
          warm-up
        </text>
      </svg>
      <BetaHistogram draws={kept} label="Histogram of the walker's positions after warm-up against the exact curve" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Walker's position" shape="line" />
        <Key color="var(--seq-250)" label="Where it spent its time" shape="bar" />
        <Key color="var(--ink)" label="Exact posterior Beta(5, 15)" shape="line" />
      </div>
    </Panel>
  );
}

const DIAG_NAMES: { id: DiagScenario; name: string }[] = [
  { id: "healthy", name: "Healthy" },
  { id: "timid", name: "Too timid" },
  { id: "short", name: "Stopped too soon" },
];

export function ChainDiagnostics() {
  const [s, setS] = useState<DiagScenario>("healthy");
  const chains = useMemo(() => diagChains(s), [s]);
  const r = rhat(chains);
  const e = essChains(chains);
  const n = chains[0].length;
  const tx = linear([0, n], [L, R]);
  const ty = linear([0, 1], [B, 10]);
  const ok = r < 1.01 && e > 400;
  return (
    <Panel
      title="Four walkers from four starting points: do they agree?"
      footer={
        <>
          R-hat <span className="font-semibold tabular" data-testid="cd-rhat">{r.toFixed(3)}</span>, effective sample size{" "}
          <span className="font-semibold tabular" data-testid="cd-ess">{Math.round(e).toLocaleString("en-IN")}</span> from {(4 * n).toLocaleString("en-IN")} draws.{" "}
          <span className="font-semibold" style={{ color: ok ? "var(--good-text)" : "var(--critical)" }}>
            {ok ? "Safe to use." : "Don't trust these draws."}
          </span>{" "}
          The usual bar: R-hat below 1.01 and at least 400 effective draws.
        </>
      }
    >
      <Radios label="Scenario" value={s} onChange={setS} options={DIAG_NAMES} />
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Traces of four chains">
        <Axis scale={ty} orient="left" at={L} gridTo={R} label="position θ" />
        <Axis scale={tx} orient="bottom" at={B} label="step" />
        {chains.map((c, j) => (
          <polyline
            key={j}
            points={c
              .filter((_, i) => i % Math.max(1, Math.floor(n / 400)) === 0)
              .map((v, i) => `${tx(i * Math.max(1, Math.floor(n / 400))).toFixed(1)},${ty(v).toFixed(1)}`)
              .join(" ")}
            fill="none"
            stroke={`var(--series-${j + 1})`}
            strokeWidth={1}
            opacity={0.85}
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[0.05, 0.35, 0.65, 0.95].map((x0, j) => (
          <Key key={x0} color={`var(--series-${j + 1})`} label={`Chain started at ${x0}`} shape="line" />
        ))}
      </div>
    </Panel>
  );
}

export const SS_STEPS = [0.01, 0.03, 0.1, 0.3, 1, 3];

export function StepSizeStudy() {
  const rows = useMemo(() => stepStudy(SS_STEPS, 20, 4000, 5), []);
  const x = linear([-0.5, SS_STEPS.length - 0.5], [L, R]);
  const y = linear([0, 900], [B, 10]);
  const bw = (R - L) / SS_STEPS.length - 14;
  return (
    <Panel
      title="20 chains of 4,000 steps at each step size: effective draws per chain"
      footer={<>Too small and every step is accepted but goes nowhere; too big and almost every step is rejected. The sweet spot accepts roughly a third of proposals.</>}
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Effective sample size for each step size">
        <Axis scale={y} orient="left" at={L} gridTo={R} label="effective draws" />
        <Axis scale={x} orient="bottom" at={B} tickValues={SS_STEPS.map((_, k) => k)} format={(v) => `step ${SS_STEPS[v]}`} />
        {rows.map((r, k) => (
          <g key={r.step}>
            <rect x={x(k) - bw / 2} y={y(r.ess)} width={bw} height={B - y(r.ess)} fill={r.step === 0.3 ? "var(--series-3)" : "var(--seq-250)"} />
            <text x={x(k)} y={y(r.ess) - 16} textAnchor="middle" fontSize={11} fill="var(--ink)" className="tabular" data-testid={`ss-ess-${r.step}`}>
              {Math.round(r.ess)}
            </text>
            <text x={x(k)} y={y(r.ess) - 4} textAnchor="middle" fontSize={10} fill="var(--muted)" className="tabular">
              {pct(r.accept, 0)} acc.
            </text>
          </g>
        ))}
      </svg>
    </Panel>
  );
}

/** Points on the ellipse at Mahalanobis radius r for the correlated Normal (via its Cholesky factor). */
function ellipse(r: number, rho: number): [number, number][] {
  return Array.from({ length: 73 }, (_, i) => {
    const t = (i / 72) * 2 * Math.PI;
    const a = r * Math.cos(t);
    const b = r * Math.sin(t);
    return [a, rho * a + Math.sqrt(1 - rho * rho) * b];
  });
}

export const RB_ITERS = 500;
export const RB_LEAPS = 20;
export const RB_RW_STEP = 0.5;

export function RollingBall() {
  const [eps, setEps] = useState(0.15);
  const [mode, setMode] = useState<"hmc" | "rw">("hmc");
  const hmc = useMemo(() => hmcRun(eps, RB_LEAPS, RB_ITERS, 4), [eps]);
  const rw = useMemo(() => rwRun(RB_RW_STEP, RB_ITERS, 4), []);
  const S = 300;
  const p = linear([-3.5, 3.5], [16, S - 16]);
  const q = linear([-3.5, 3.5], [S - 16, 16]);
  const run = mode === "hmc" ? hmc : rw;
  const essShown = (v: number) => (v >= RB_ITERS ? `${RB_ITERS}+` : String(Math.round(v)));
  return (
    <Panel
      title="Two parameters the data can't separate (correlation 0.95): walker vs rolling ball"
      footer={
        <>
          {RB_ITERS} iterations each. Rolling ball (HMC, {RB_LEAPS} leapfrog steps of size {eps.toFixed(2)}): accepted{" "}
          <span className="font-semibold tabular" data-testid="rb-accept">{pct(hmc.accepted / RB_ITERS, 0)}</span>, divergent trajectories{" "}
          <span className="font-semibold tabular" data-testid="rb-div">{hmc.divergences}</span>, average move{" "}
          <span className="font-semibold tabular" data-testid="rb-jump">{avgJump(hmc).toFixed(2)}</span>, effective draws {essShown(ess(hmc.xs))}. Random walk (step{" "}
          {RB_RW_STEP}): accepted {pct(rw.accepted / RB_ITERS, 0)}, average move <span className="font-semibold tabular" data-testid="rb-rw-jump">{avgJump(rw).toFixed(2)}</span>, effective draws{" "}
          {essShown(ess(rw.xs))}.
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <Radios
          label="Sampler"
          value={mode}
          onChange={setMode}
          options={[
            { id: "hmc", name: "Rolling ball (HMC)" },
            { id: "rw", name: "Random walk" },
          ]}
        />
        <Slider id="rb-eps" label="Leapfrog step size ε" value={eps} min={0.05} max={0.5} step={0.05} onChange={(v) => setEps(Math.round(v * 100) / 100)} display={(v) => v.toFixed(2)} />
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto mt-3 h-auto w-full max-w-[360px]" role="img" aria-label={mode === "hmc" ? "HMC trajectories over the posterior contours" : "Random-walk path over the posterior contours"}>
        <defs>
          <clipPath id="rb-clip">
            <rect x={16} y={16} width={S - 32} height={S - 32} />
          </clipPath>
        </defs>
        <rect x={16} y={16} width={S - 32} height={S - 32} fill="none" stroke="var(--axis)" />
        {[1, 2, 3].map((r) => (
          <polyline key={r} points={ellipse(r, HMC_RHO).map(([a, b]) => `${p(a).toFixed(1)},${q(b).toFixed(1)}`).join(" ")} fill="none" stroke="var(--grid)" strokeWidth={1.5} />
        ))}
        <g clipPath="url(#rb-clip)">
          {mode === "hmc"
            ? hmc.trajectories.slice(0, 12).map((t, i) => (
                <polyline
                  key={i}
                  points={t.path.map(([a, b]) => `${p(a).toFixed(1)},${q(b).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={t.divergent ? "var(--critical)" : "var(--series-3)"}
                  strokeWidth={1.2}
                  strokeDasharray={t.divergent ? "3 2" : undefined}
                />
              ))
            : (
                <polyline points={rw.xs.map((a, i) => `${p(a).toFixed(1)},${q(rw.ys[i]).toFixed(1)}`).join(" ")} fill="none" stroke="var(--series-2)" strokeWidth={1} />
              )}
          {run.xs.map((a, i) => (
            <circle key={i} cx={p(a)} cy={q(run.ys[i])} r={1.6} fill="var(--ink)" opacity={0.5} />
          ))}
        </g>
        <text x={S / 2} y={S - 2} textAnchor="middle" fontSize={11} fill="var(--muted)">
          parameter 1 (standardized)
        </text>
        <text x={10} y={S / 2} textAnchor="middle" fontSize={11} fill="var(--muted)" transform={`rotate(-90 10 ${S / 2})`}>
          parameter 2 (standardized)
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--grid)" label="Posterior contours (1, 2, 3 sd)" shape="line" />
        {mode === "hmc" ? (
          <>
            <Key color="var(--series-3)" label="First 12 ball trajectories" shape="line" />
            <Key color="var(--critical)" label="Divergent trajectory" shape="line" />
          </>
        ) : (
          <Key color="var(--series-2)" label="Walker's path" shape="line" />
        )}
        <Key color="var(--ink)" label={`Kept draws (${RB_ITERS})`} />
      </div>
      <p className="mt-2 text-xs text-muted">{fmt(2 * Math.sqrt(1 - HMC_RHO), 3)} is the largest stable step for this shape: push ε past it and every trajectory blows up.</p>
    </Panel>
  );
}

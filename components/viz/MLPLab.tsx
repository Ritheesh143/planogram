"use client";

import { useMemo, useState } from "react";
import { backward, predictMLP, trainMLP, type Layer } from "@/lib/sim/mlp";
import { mulberry32, normal } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 260;
const L = 52;
const B = H - 34;

// Weekly demand for a cordless drill against its price (₹ thousands): steep up to ₹4k, then flat.
export const demandCurve = (x: number) => 60 - 12 * x + 9 * Math.max(0, x - 4);
function demandData(n: number, seed: number, spread: boolean) {
  const rng = mulberry32(seed);
  const xs = Array.from({ length: n }, (_, i) => (spread ? 1 + rng() * 6 : 1 + (i * 6) / (n - 1)));
  return { xs, ys: xs.map((x) => Math.round((demandCurve(x) + normal(rng, 0, 2)) * 10) / 10) };
}
export const DEMAND = demandData(30, 41, false);

const relu = (v: number) => Math.max(0, v);

/** Build a demand curve out of ReLU bends: each hidden unit adds one kink. */
export function ReluKinks() {
  const [a, setA] = useState(60);
  const [m, setM] = useState(-12);
  const [k1, setK1] = useState(3);
  const [s1, setS1] = useState(0);
  const [k2, setK2] = useState(6);
  const [s2, setS2] = useState(0);
  const [fitted, setFitted] = useState<{ curve: number[]; sse: number } | null>(null);
  const f = (x: number) => a + m * x + s1 * relu(x - k1) + s2 * relu(x - k2);
  const sse = DEMAND.xs.reduce((s, x, i) => s + (DEMAND.ys[i] - f(x)) ** 2, 0);
  const x = linear([1, 7], [L, VW - 14]);
  const y = linear([-10, 60], [B, 12]);
  const xs = Array.from({ length: 121 }, (_, i) => 1 + i * 0.05);
  const path = (g: (v: number) => number) => xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(Math.max(-10, Math.min(60, g(v)))).toFixed(1)}`).join("");
  const runFit = () => {
    const { model } = trainMLP(DEMAND.xs.map((v) => [v]), DEMAND.ys, { hidden: [3], epochs: 3000, lr: 0.02, seed: 2 });
    setFitted({
      curve: xs.map((v) => predictMLP(model, [v])),
      sse: DEMAND.xs.reduce((t, xv, i) => t + (DEMAND.ys[i] - predictMLP(model, [xv])) ** 2, 0),
    });
  };
  const fitSse = fitted?.sse ?? null;

  return (
    <Panel
      title="Two hidden units, two possible bends. Shape the curve to the drill's demand."
      footer={
        <>
          Your squared error: <span className="font-semibold tabular" data-testid="rk-sse">{fmt(sse, 1)}</span>.
          {fitSse !== null && (
            <>
              {" "}
              Gradient descent with 3 hidden units reached <span className="font-semibold tabular" data-testid="rk-fit">{fmt(fitSse, 1)}</span>.
            </>
          )}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="rk-a" label="Bias a" value={a} min={30} max={90} step={1} onChange={setA} />
        <Slider id="rk-m" label="Starting slope (units per ₹1k)" value={m} min={-20} max={0} step={0.5} onChange={setM} />
        <Slider id="rk-k1" label="Unit 1: kink at ₹k (thousands)" value={k1} min={1} max={7} step={0.25} onChange={setK1} />
        <Slider id="rk-s1" label="Unit 1: slope change after the kink" value={s1} min={-15} max={15} step={0.5} onChange={setS1} />
        <Slider id="rk-k2" label="Unit 2: kink at ₹k (thousands)" value={k2} min={1} max={7} step={0.25} onChange={setK2} />
        <Slider id="rk-s2" label="Unit 2: slope change after the kink" value={s2} min={-15} max={15} step={0.5} onChange={setS2} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={runFit} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white">
          Let gradient descent fit 3 units
        </button>
        {fitted && (
          <button type="button" onClick={() => setFitted(null)} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
            Hide the fitted network
          </button>
        )}
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Drill demand against price with your ReLU curve">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="drills / week" />
        <Axis scale={x} orient="bottom" at={B} format={(v) => `₹${v}k`} label="price" />
        {[
          [k1, s1],
          [k2, s2],
        ].map(([k, s], i) =>
          s !== 0 ? (
            <g key={i}>
              <line x1={x(k)} x2={x(k)} y1={12} y2={B} stroke="var(--muted)" strokeDasharray="3 3" />
              <path d={path((v) => s * relu(v - k) - 8)} fill="none" stroke={i ? "var(--series-4)" : "var(--series-3)"} strokeWidth={1.5} />
            </g>
          ) : null,
        )}
        {DEMAND.xs.map((v, i) => (
          <circle key={i} cx={x(v)} cy={y(DEMAND.ys[i])} r={3.5} fill="var(--ink-2)" />
        ))}
        {fitted && <path d={xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(fitted.curve[i]).toFixed(1)}`).join("")} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 4" />}
        <path d={path(f)} fill="none" stroke="var(--series-1)" strokeWidth={2.5} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink-2)" label="A week of sales" />
        <Key color="var(--series-1)" label="Your network: a + slope·x + Σ unit outputs" shape="line" />
        <Key color="var(--series-3)" label="Unit 1's contribution (shifted down)" shape="line" />
        <Key color="var(--series-4)" label="Unit 2's contribution" shape="line" />
        {fitted && <Key color="var(--series-2)" label="Trained 3-unit network" shape="line" />}
      </div>
    </Panel>
  );
}

// The tiny network from By Hand: x = 2, target 10.
export const BP_X = 2;
export const BP_Y = 10;
export const BP_START: Layer[] = [
  { W: [[1], [-1]], b: [0, 3] },
  { W: [[3, 2]], b: [1] },
];

const clone = (ls: Layer[]): Layer[] => ls.map((l) => ({ W: l.W.map((r) => [...r]), b: [...l.b] }));

/** One forward pass, one backward pass, one step: every number visible. */
export function BackpropStep() {
  const [layers, setLayers] = useState<Layer[]>(() => clone(BP_START));
  const [lr, setLr] = useState(0.01);
  const [steps, setSteps] = useState(0);
  const z = layers[0].W.map((r, j) => r[0] * BP_X + layers[0].b[j]);
  const h = z.map(relu);
  const { grads, pred } = backward(layers, [BP_X], BP_Y);
  const loss = 0.5 * (pred - BP_Y) ** 2;
  const step = () => {
    const next = clone(layers);
    next.forEach((l, li) => {
      l.W.forEach((r, j) => r.forEach((w, k) => (r[k] = w - lr * grads.dW[li][j][k])));
      l.b.forEach((b, j) => (l.b[j] = b - lr * grads.db[li][j]));
    });
    setLayers(next);
    setSteps((s) => s + 1);
  };
  const node = (cx: number, cy: number, label: string, value: string) => (
    <g>
      <circle cx={cx} cy={cy} r={24} fill="var(--surface-2)" stroke="var(--axis)" />
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
        {label}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)" className="tabular">
        {value}
      </text>
    </g>
  );
  const edge = (x1: number, y1: number, x2: number, y2: number, w: string, g: string, lx: number, ly: number) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--axis)" strokeWidth={1.5} />
      <text x={lx} y={ly} fontSize={11} fill="var(--ink)" textAnchor="middle" className="tabular">
        w = {w}
      </text>
      <text x={lx} y={ly + 14} fontSize={11} fill="var(--series-2)" textAnchor="middle" className="tabular">
        ∂L/∂w = {g}
      </text>
    </g>
  );
  const W0 = layers[0].W;
  const W1 = layers[1].W[0];
  return (
    <Panel
      title="A 1–2–1 network; h₁ and h₂ are ReLU units. Forward gives the prediction; backward gives every weight's gradient."
      footer={
        <>
          After {steps} {steps === 1 ? "step" : "steps"}: prediction <span className="font-semibold tabular" data-testid="bp-pred">{fmt(pred, 3)}</span> (target {BP_Y}), loss ½(ŷ − y)² ={" "}
          <span className="font-semibold tabular" data-testid="bp-loss">{fmt(loss, 4)}</span>.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-2">Learning rate</span>
        {[0.01, 0.05].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setLr(v)}
            aria-pressed={lr === v}
            className={lr === v ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {v}
          </button>
        ))}
        <button type="button" onClick={step} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white">
          Take one gradient step
        </button>
        <button
          type="button"
          onClick={() => {
            setLayers(clone(BP_START));
            setSteps(0);
          }}
          className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent"
        >
          Reset
        </button>
      </div>
      <svg viewBox="0 0 520 250" className="mt-3 h-auto w-full" role="img" aria-label={`Network diagram: prediction ${fmt(pred, 3)}`}>
        {edge(70, 125, 250, 60, fmt(W0[0][0], 3), fmt(grads.dW[0][0][0], 3), 150, 62)}
        {edge(70, 125, 250, 190, fmt(W0[1][0], 3), fmt(grads.dW[0][1][0], 3), 150, 178)}
        {edge(250, 60, 440, 125, fmt(W1[0], 3), fmt(grads.dW[1][0][0], 3), 360, 62)}
        {edge(250, 190, 440, 125, fmt(W1[1], 3), fmt(grads.dW[1][0][1], 3), 360, 178)}
        {node(70, 125, "x", String(BP_X))}
        {node(250, 60, "h₁", fmt(h[0], 3))}
        {node(250, 190, "h₂", fmt(h[1], 3))}
        {node(440, 125, "ŷ", fmt(pred, 3))}
        <text x={250} y={104} textAnchor="middle" fontSize={10} fill="var(--ink-2)" className="tabular">
          b₁ = {fmt(layers[0].b[0], 3)}, z₁ = {fmt(z[0], 3)}
        </text>
        <text x={250} y={234} textAnchor="middle" fontSize={10} fill="var(--ink-2)" className="tabular">
          b₂ = {fmt(layers[0].b[1], 3)}, z₂ = {fmt(z[1], 3)}
        </text>
        <text x={440} y={168} textAnchor="middle" fontSize={10} fill="var(--ink-2)" className="tabular">
          c = {fmt(layers[1].b[0], 3)}
        </text>
        <text x={440} y={182} textAnchor="middle" fontSize={10} fill="var(--series-2)" className="tabular">
          δ = ŷ − y = {fmt(pred - BP_Y, 3)}
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink)" label="Weight" shape="line" />
        <Key color="var(--series-2)" label="Gradient of the loss for that weight" shape="line" />
      </div>
    </Panel>
  );
}

const HIDDEN = [1, 2, 4, 8, 16];
const RATES = [0.001, 0.01, 0.1];
const DECAY = [0, 0.01, 0.1];

/** Train an MLP on the drill data with price in rupees: scaling, optimizer and size all matter. */
export function MLPTrainer() {
  const train = useMemo(() => demandData(30, 41, false), []);
  const test = useMemo(() => demandData(200, 42, true), []);
  const [hIdx, setHIdx] = useState(4);
  const [layers, setLayers] = useState(1);
  const [opt, setOpt] = useState<"adam" | "sgd">("adam");
  const [rIdx, setRIdx] = useState(1);
  const [scale, setScale] = useState(true);
  const [dIdx, setDIdx] = useState(0);
  const [seed, setSeed] = useState(7);
  // Price in rupees (1,000–7,000), as it would arrive from a pricing table.
  const run = useMemo(() => {
    const X = train.xs.map((v) => [v * 1000]);
    const hidden = Array.from({ length: layers }, () => HIDDEN[hIdx]);
    const { model, loss } = trainMLP(X, train.ys, { hidden, epochs: 1500, lr: RATES[rIdx], optimizer: opt, scale, weightDecay: DECAY[dIdx], seed });
    const p = (v: number) => predictMLP(model, [v * 1000]);
    const rmse = (d: { xs: number[]; ys: number[] }) => Math.sqrt(d.xs.reduce((s, v, i) => s + (p(v) - d.ys[i]) ** 2, 0) / d.xs.length);
    return { p, loss, trainRmse: rmse(train), testRmse: rmse(test) };
  }, [train, test, hIdx, layers, opt, rIdx, scale, dIdx, seed]);
  const diverged = !Number.isFinite(run.testRmse) || run.testRmse > 1e4;
  const x = linear([1, 7], [L, VW - 14]);
  const y = linear([-10, 60], [B, 12]);
  const xs = Array.from({ length: 121 }, (_, i) => 1 + i * 0.05);
  const ex = linear([0, 1500], [L, VW - 14]);
  const rm = run.loss.map((v) => Math.sqrt(v));
  const ey = linear([0, 3.5], [B, 12]);
  const ly = (v: number) => ey(Math.log10(Math.max(1, Math.min(10 ** 3.5, Number.isFinite(v) ? v : 1e9))));
  const choice = <T,>(items: T[], cur: T, set: (v: T) => void, label: (v: T) => string, name: string) => (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={name}>
      <span className="w-28 text-xs text-ink-2">{name}</span>
      {items.map((v) => (
        <button
          key={label(v)}
          type="button"
          role="radio"
          aria-checked={cur === v}
          onClick={() => set(v)}
          className={cur === v ? "rounded-md bg-accent px-2 py-0.5 text-xs text-white" : "rounded-md border border-line px-2 py-0.5 text-xs"}
        >
          {label(v)}
        </button>
      ))}
    </div>
  );

  return (
    <Panel
      title="Train an MLP on 30 weeks of drill sales, with price arriving in rupees"
      footer={
        diverged ? (
          <span data-testid="mt-test">Training diverged: the loss blew up to infinity. Lower the learning rate or scale the inputs.</span>
        ) : (
          <>
            Train error {fmt(run.trainRmse, 2)}, test error on 200 new weeks <span className="font-semibold tabular" data-testid="mt-test">{fmt(run.testRmse, 2)}</span> drills. The noise is 2, so about 2 is the best possible.
          </>
        )
      }
    >
      <div className="space-y-2">
        {choice(HIDDEN, HIDDEN[hIdx], (v) => setHIdx(HIDDEN.indexOf(v)), String, "Hidden units")}
        {choice([1, 2], layers, setLayers, String, "Hidden layers")}
        {choice<"adam" | "sgd">(["adam", "sgd"], opt, setOpt, (v) => (v === "adam" ? "Adam" : "Plain SGD"), "Optimizer")}
        {choice(RATES, RATES[rIdx], (v) => setRIdx(RATES.indexOf(v)), String, "Learning rate")}
        {choice(DECAY, DECAY[dIdx], (v) => setDIdx(DECAY.indexOf(v)), String, "Weight decay")}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} data-testid="mt-scale" /> Standardize inputs and target
          </label>
          <button type="button" onClick={() => setSeed((s) => s + 1)} className="rounded-lg border border-line px-3 py-1 text-xs hover:border-accent">
            New random initialization
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Trained network's demand curve">
          <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="drills / week" />
          <Axis scale={x} orient="bottom" at={B} format={(v) => `₹${v}k`} label="price" />
          {train.xs.map((v, i) => (
            <circle key={i} cx={x(v)} cy={y(train.ys[i])} r={3.5} fill="var(--ink-2)" />
          ))}
          <path d={xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(demandCurve(v)).toFixed(1)}`).join("")} fill="none" stroke="var(--muted)" strokeDasharray="5 4" />
          {!diverged && <path d={xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(Math.max(-10, Math.min(60, run.p(v)))).toFixed(1)}`).join("")} fill="none" stroke="var(--series-4)" strokeWidth={2.5} />}
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Training error by epoch, log scale">
          <Axis scale={ey} orient="left" at={L} gridTo={VW - 14} tickValues={[0, 1, 2, 3]} format={(v) => String(10 ** v)} label="train RMSE (log)" />
          <Axis scale={ex} orient="bottom" at={B} label="epoch" />
          <polyline points={rm.map((v, i) => `${ex(i).toFixed(1)},${ly(v).toFixed(1)}`).join(" ")} fill="none" stroke="var(--series-4)" strokeWidth={2} />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink-2)" label="Training weeks" />
        <Key color="var(--series-4)" label="MLP" shape="line" />
        <Key color="var(--muted)" label="True demand curve" shape="line" />
      </div>
    </Panel>
  );
}

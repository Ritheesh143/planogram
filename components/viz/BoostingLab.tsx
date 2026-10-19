"use client";

import { useMemo, useState } from "react";
import { fitGBM, predictGBM, pseudoResiduals, rawScore, type Loss } from "@/lib/sim/gbm";
import { mulberry32, normal } from "@/lib/sim/rng";
import { fitXGB, predictXGB, xLeaves } from "@/lib/sim/xgb";
import { BOOST_X, BOOST_Y } from "./BoostingByHand";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

const VW = 460;
const H = 260;
const L = 52;
const B = H - 34;

const LOSSES: { id: Loss; name: string; target: string }[] = [
  { id: "squared", name: "Squared", target: "mean" },
  { id: "absolute", name: "Absolute", target: "median" },
  { id: "quantile", name: "Quantile τ = 0.9", target: "90th percentile" },
  { id: "poisson", name: "Poisson", target: "rate (log link)" },
];

function lossValue(loss: Loss, y: number[], pred: number[], F: number[]): number {
  const n = y.length;
  switch (loss) {
    case "squared":
      return y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0) / n;
    case "absolute":
      return y.reduce((s, v, i) => s + Math.abs(v - pred[i]), 0) / n;
    case "quantile":
      return y.reduce((s, v, i) => s + (v >= pred[i] ? 0.9 * (v - pred[i]) : 0.1 * (pred[i] - v)), 0) / n;
    case "poisson":
      return y.reduce((s, v, i) => s + Math.exp(F[i]) - v * F[i], 0) / n;
  }
}

/** Boosting as gradient descent on the predictions: one arrow per store, pointing where the loss wants it to go. */
export function GBMFunctionSpace() {
  const [loss, setLoss] = useState<Loss>("absolute");
  const [round, setRound] = useState(0);
  const [lrIdx, setLrIdx] = useState(1);
  const rates = [0.1, 0.5, 1];
  const lr = rates[lrIdx];
  const X = useMemo(() => BOOST_X.map((v) => [v]), []);
  const model = useMemo(() => fitGBM(X, BOOST_Y, { rounds: 30, lr, maxDepth: 1, loss, alpha: 0.9 }), [X, lr, loss]);
  const F = X.map((r) => rawScore(model, r, round));
  const pred = X.map((r) => predictGBM(model, r, round));
  const g = pseudoResiduals(loss, BOOST_Y, F, 0.9);
  const history = useMemo(
    () =>
      Array.from({ length: 31 }, (_, m) => {
        const Fm = X.map((r) => rawScore(model, r, m));
        return lossValue(loss, BOOST_Y, X.map((r) => predictGBM(model, r, m)), Fm);
      }),
    [model, X, loss],
  );
  const x = linear([10, 100], [L, VW - 14]);
  const y = linear([0, 60], [B, 12]);
  const gMax = Math.max(1e-9, ...g.map(Math.abs));
  const xs = Array.from({ length: 181 }, (_, i) => 10 + i * 0.5);
  const curve = xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(Math.min(60, predictGBM(model, [v], round))).toFixed(1)}`).join("");
  const hx = linear([0, 30], [L, VW - 14]);
  const hy = linear([0, Math.max(...history) * 1.05], [B, 12]);
  const info = LOSSES.find((l) => l.id === loss)!;

  return (
    <Panel
      title="Every round nudges each store's prediction downhill. The arrows are the negative gradient; the tree generalizes them."
      footer={
        <>
          Round {round}: predictions <span className="font-semibold tabular" data-testid="fs-pred">{pred.map((p) => fmt(p, 2)).join(", ")}</span>. The arrows are the{" "}
          {loss === "absolute" ? "signs of the residuals (each is ±1)" : loss === "quantile" ? "pinball gradients: +0.9 below, −0.1 above" : loss === "poisson" ? "count residuals y − e^F" : "residuals y − F"}. This loss aims at the {info.target}.
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Loss">
        {LOSSES.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={loss === l.id}
            onClick={() => setLoss(l.id)}
            className={loss === l.id ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Slider id="fs-round" label="Boosting round" value={round} min={0} max={30} step={1} onChange={setRound} />
        <Slider id="fs-lr" label="Learning rate" value={lrIdx} min={0} max={rates.length - 1} step={1} onChange={setLrIdx} display={(i) => String(rates[i])} />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label={`Predictions after round ${round} with gradient arrows`}>
          <defs>
            <marker id="fs-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0L10,5L0,10z" fill="var(--series-3)" />
            </marker>
          </defs>
          <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="drills / week" />
          <Axis scale={x} orient="bottom" at={B} label="store size (thousand sq ft)" />
          <path d={curve} fill="none" stroke="var(--series-2)" strokeWidth={2} />
          {BOOST_X.map((v, i) => {
            const len = (g[i] / gMax) * 30;
            return (
              <g key={i}>
                <circle cx={x(v)} cy={y(BOOST_Y[i])} r={5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
                {Math.abs(len) > 1 && (
                  <line x1={x(v) + 7} x2={x(v) + 7} y1={y(pred[i])} y2={y(pred[i]) - len} stroke="var(--series-3)" strokeWidth={2.5} markerEnd="url(#fs-arrow)" />
                )}
              </g>
            );
          })}
        </svg>
        <svg viewBox={`0 0 ${VW} ${H}`} className="h-auto w-full" role="img" aria-label="Average loss by round">
          <Axis scale={hy} orient="left" at={L} gridTo={VW - 14} label="average loss" format={(v) => fmt(v, 1)} />
          <Axis scale={hx} orient="bottom" at={B} label="round" />
          <polyline points={history.map((v, m) => `${hx(m)},${hy(v)}`).join(" ")} fill="none" stroke="var(--series-2)" strokeWidth={2} />
          <circle cx={hx(round)} cy={hy(history[round])} r={5} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Actual drills sold" />
        <Key color="var(--series-2)" label="Prediction (sum of stumps so far)" shape="line" />
        <Key color="var(--series-3)" label="Negative gradient at each store (scaled)" shape="line" />
      </div>
    </Panel>
  );
}

// 60 stores on a diminishing-returns curve for the knobs playground, plus 400 test stores.
function curveData(n: number, seed: number) {
  const rng = mulberry32(seed);
  const X = Array.from({ length: n }, () => [rng() * 40]);
  const y = X.map(([d]) => 50 + 80 * (1 - Math.exp(-d / 10)) + normal(rng, 0, 8));
  return { X, y };
}

export function GBMKnobs() {
  const train = useMemo(() => curveData(60, 21), []);
  const test = useMemo(() => curveData(400, 22), []);
  const [depth, setDepth] = useState(3);
  const [lambda, setLambda] = useState(0);
  const [gamma, setGamma] = useState(0);
  const [mcw, setMcw] = useState(0);
  const [sub, setSub] = useState(1);
  const model = useMemo(
    () => fitXGB(train.X, train.y, { rounds: 60, lr: 0.3, maxDepth: depth, lambda, gamma, minChildWeight: mcw, subsample: sub, rng: mulberry32(5) }),
    [train, depth, lambda, gamma, mcw, sub],
  );
  const rmse = (d: typeof train) => Math.sqrt(d.X.reduce((s, r, i) => s + (predictXGB(model, r) - d.y[i]) ** 2, 0) / d.X.length);
  const leafCount = model.trees.reduce((s, t) => s + xLeaves(t).length, 0);
  const x = linear([0, 40], [L, VW - 14]);
  const y = linear([30, 160], [B, 12]);
  const xs = Array.from({ length: 201 }, (_, i) => i * 0.2);
  const path = xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(Math.max(30, Math.min(160, predictXGB(model, [v])))).toFixed(1)}`).join("");
  const truth = xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(50 + 80 * (1 - Math.exp(-v / 10))).toFixed(1)}`).join("");

  return (
    <Panel
      title="60 boosted trees (learning rate 0.3) on 60 noisy stores. Every knob is a different brake on memorizing noise."
      footer={
        <>
          {leafCount} leaves across 60 trees. Train error {fmt(rmse(train), 1)}, test error on 400 new stores{" "}
          <span className="font-semibold tabular" data-testid="gk-test">{fmt(rmse(test), 1)}</span>. The noise is 8, so a perfect model scores about 8.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider id="gk-depth" label="max_depth" value={depth} min={1} max={6} step={1} onChange={setDepth} />
        <Slider id="gk-lambda" label="reg_lambda (λ)" value={lambda} min={0} max={50} step={1} onChange={setLambda} />
        <Slider id="gk-gamma" label="gamma (γ)" value={gamma} min={0} max={300} step={10} onChange={setGamma} />
        <Slider id="gk-mcw" label="min_child_weight" value={mcw} min={0} max={20} step={1} onChange={setMcw} />
        <Slider id="gk-sub" label="subsample" value={sub} min={0.3} max={1} step={0.1} onChange={setSub} display={(v) => fmt(v, 1)} />
      </div>
      <svg viewBox={`0 0 ${VW} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Boosted fit over discount depth">
        <Axis scale={y} orient="left" at={L} gridTo={VW - 14} label="units / week" />
        <Axis scale={x} orient="bottom" at={B} label="discount (%)" />
        {train.X.map((r, i) => (
          <circle key={i} cx={x(r[0])} cy={y(train.y[i])} r={3} fill="var(--ink-2)" />
        ))}
        <path d={truth} fill="none" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1.5} />
        <path d={path} fill="none" stroke="var(--series-3)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--ink-2)" label="Training stores" />
        <Key color="var(--series-3)" label="Boosted model" shape="line" />
        <Key color="var(--muted)" label="True curve" shape="line" />
      </div>
    </Panel>
  );
}

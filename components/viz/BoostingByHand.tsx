"use client";

import { useMemo, useState } from "react";
import { boost, predictAt } from "@/lib/sim/boosting";
import { mulberry32, normal } from "@/lib/sim/rng";
import { Axis, fmt, Key, linear, Panel, Slider } from "./kit";

// Six Bolt & Beam stores: floor area (thousand sq ft) and weekly cordless-drill sales.
export const BOOST_X = [20, 30, 40, 55, 70, 90];
export const BOOST_Y = [10, 18, 14, 34, 40, 52];
const NAMES = ["A", "B", "C", "D", "E", "F"];
const MAX_ROUNDS = 15;
const rates = [0.1, 0.3, 0.5, 1];
const VW = 460;
const H = 250;

export function BoostingByHand() {
  const [round, setRound] = useState(1);
  const [rateIdx, setRateIdx] = useState(2);
  const lr = rates[rateIdx];
  const history = useMemo(() => boost(BOOST_X, BOOST_Y, MAX_ROUNDS, lr), [lr]);
  const cur = history[round];
  const prevResiduals = round > 0 ? history[round - 1].residuals : null;
  const tree = cur.stump;

  const x = linear([10, 100], [48, VW - 14]);
  const y = linear([0, 60], [H - 34, 12]);

  // Ensemble prediction as a step function across all store sizes.
  const xs = Array.from({ length: 181 }, (_, i) => 10 + i * 0.5);
  const stepPath = xs
    .map((xi, i) => `${i ? "L" : "M"}${x(xi).toFixed(1)},${y(predictAt(history, BOOST_Y, lr, round, xi)).toFixed(1)}`)
    .join("");

  // Second chart: the residuals this round's tree was fitted to, and the tree itself.
  const ry = linear([-25, 25], [H - 34, 12]);

  return (
    <Panel title="Gradient boosting on six stores. Each round, a one-split tree learns the current mistakes.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id="bh-round" label="Boosting round" value={round} min={0} max={MAX_ROUNDS} step={1} onChange={setRound} display={(v) => (v === 0 ? "0 (just the mean)" : `${v}`)} />
        <Slider id="bh-lr" label="Learning rate" value={rateIdx} min={0} max={rates.length - 1} step={1} onChange={setRateIdx} display={(i) => String(rates[i])} />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => setRound((r) => Math.max(0, r - 1))} className="rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
          ← Previous round
        </button>
        <button type="button" onClick={() => setRound((r) => Math.min(MAX_ROUNDS, r + 1))} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white">
          Next round →
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-sm font-medium">The ensemble after round {round}</div>
          <svg viewBox={`0 0 ${VW} ${H}`} className="mt-1 w-full h-auto" role="img" aria-label={`Ensemble prediction after round ${round}`}>
            <Axis scale={y} orient="left" at={48} gridTo={VW - 14} label="drills / week" />
            <Axis scale={x} orient="bottom" at={H - 34} label="store size (thousand sq ft)" />
            {BOOST_X.map((xi, i) => (
              <line key={i} x1={x(xi)} x2={x(xi)} y1={y(BOOST_Y[i])} y2={y(cur.pred[i])} stroke="var(--muted)" strokeWidth={1} />
            ))}
            <path d={stepPath} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
            {BOOST_X.map((xi, i) => (
              <g key={i}>
                <circle cx={x(xi)} cy={y(BOOST_Y[i])} r={5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
                <text x={x(xi) + 8} y={y(BOOST_Y[i]) - 6} fontSize={11} fill="var(--ink-2)">
                  {NAMES[i]}
                </text>
              </g>
            ))}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Key color="var(--series-1)" label="Actual sales" />
            <Key color="var(--series-2)" label="Prediction (sum of all trees so far)" shape="line" />
            <Key color="var(--muted)" label="Residual = actual − prediction" shape="line" />
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">
            {tree ? `Tree ${round}: fitted to the residuals left after round ${round - 1}` : "Round 0 has no tree, only the mean"}
          </div>
          <svg viewBox={`0 0 ${VW} ${H}`} className="mt-1 w-full h-auto" role="img" aria-label="Residuals and the stump fitted to them">
            <Axis scale={ry} orient="left" at={48} gridTo={VW - 14} label="residual" />
            <Axis scale={x} orient="bottom" at={H - 34} label="store size (thousand sq ft)" />
            <line x1={48} x2={VW - 14} y1={ry(0)} y2={ry(0)} stroke="var(--axis)" />
            {tree && prevResiduals && (
              <>
                <line x1={x(tree.threshold)} x2={x(tree.threshold)} y1={12} y2={H - 34} stroke="var(--ink-2)" strokeWidth={1} />
                <text x={x(tree.threshold) + 4} y={22} fontSize={11} fill="var(--ink)">
                  split at {fmt(tree.threshold, 1)}
                </text>
                <path
                  d={`M${x(10)},${ry(tree.left)}H${x(tree.threshold)}V${ry(tree.right)}H${x(100)}`}
                  fill="none"
                  stroke="var(--series-3)"
                  strokeWidth={2}
                />
                <text x={x(12)} y={ry(tree.left) - 6} fontSize={11} fill="var(--ink)">
                  {fmt(tree.left, 2)}
                </text>
                <text x={x(98)} y={ry(tree.right) - 6} fontSize={11} fill="var(--ink)" textAnchor="end">
                  {fmt(tree.right, 2)}
                </text>
                {BOOST_X.map((xi, i) => (
                  <circle key={i} cx={x(xi)} cy={ry(prevResiduals[i])} r={5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
                ))}
              </>
            )}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Key color="var(--series-1)" label="Residual this tree must learn" />
            <Key color="var(--series-3)" label="The tree: mean residual on each side" shape="line" />
          </div>
        </div>
      </div>

      {tree && cur.candidates && (
        <div className="mt-4">
          <div className="text-sm font-medium">Split search for tree {round}: try every gap, keep the lowest squared error</div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm tabular">
              <thead className="text-left text-xs text-ink-2">
                <tr>
                  <th className="py-1 pr-3 font-medium">Split at</th>
                  <th className="py-1 pr-3 font-medium">Left mean</th>
                  <th className="py-1 pr-3 font-medium">Right mean</th>
                  <th className="py-1 font-medium">Squared error</th>
                </tr>
              </thead>
              <tbody>
                {cur.candidates.map((c) => {
                  const best = c.threshold === tree.threshold;
                  const maxSse = Math.max(...cur.candidates!.map((d) => d.sse));
                  return (
                    <tr key={c.threshold} className={best ? "font-semibold" : ""}>
                      <td className="border-t border-line py-1 pr-3">
                        {fmt(c.threshold, 1)} {best && <span className="text-good">✓ best</span>}
                      </td>
                      <td className="border-t border-line py-1 pr-3">{fmt(c.left, 2)}</td>
                      <td className="border-t border-line py-1 pr-3">{fmt(c.right, 2)}</td>
                      <td className="border-t border-line py-1">
                        <div className="flex items-center gap-2">
                          <span className="w-14">{fmt(c.sse, 1)}</span>
                          <span
                            className="h-2.5 rounded-r"
                            style={{ width: `${(c.sse / maxSse) * 120}px`, background: best ? "var(--series-1)" : "var(--axis)" }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular" data-testid="bh-table">
            <thead className="text-left text-xs text-ink-2">
              <tr>
                <th className="py-1 pr-3 font-medium">Store</th>
                <th className="py-1 pr-3 font-medium">Size</th>
                <th className="py-1 pr-3 font-medium">Actual</th>
                <th className="py-1 pr-3 font-medium">Prediction</th>
                <th className="py-1 font-medium">Residual</th>
              </tr>
            </thead>
            <tbody>
              {BOOST_X.map((xi, i) => (
                <tr key={i}>
                  <td className="border-t border-line py-1 pr-3">{NAMES[i]}</td>
                  <td className="border-t border-line py-1 pr-3">{xi}</td>
                  <td className="border-t border-line py-1 pr-3">{BOOST_Y[i]}</td>
                  <td className="border-t border-line py-1 pr-3">{fmt(cur.pred[i], 2)}</td>
                  <td className="border-t border-line py-1">{fmt(cur.residuals[i], 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SseSparkline history={history.map((h) => h.sse)} round={round} />
      </div>
    </Panel>
  );
}

function SseSparkline({ history, round }: { history: number[]; round: number }) {
  const W = 260;
  const SH = 140;
  const x = linear([0, history.length - 1], [36, W - 8]);
  const y = linear([0, history[0]], [SH - 26, 10]);
  const d = history.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  return (
    <div>
      <div className="text-sm font-medium">Total squared error by round</div>
      <svg viewBox={`0 0 ${W} ${SH}`} className="mt-1 w-full h-auto" role="img" aria-label="Training error falling over rounds">
        <Axis scale={y} orient="left" at={36} tickValues={[0, Math.round(history[0] / 2), Math.round(history[0])]} gridTo={W - 8} />
        <Axis scale={x} orient="bottom" at={SH - 26} tickValues={[0, 5, 10, 15]} />
        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(round)} cy={y(history[round])} r={4.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
      </svg>
      <div className="text-xs text-ink-2 tabular" data-testid="bh-sse">
        Round {round}: {fmt(history[round], 2)}
      </div>
    </div>
  );
}

const OVERFIT_ROUNDS = 300;
const overfitRates = [0.05, 0.3, 1];

/** Same algorithm on 40 noisy stores, scored on 400 stores it never saw. */
export function BoostingOverfit() {
  const [rateIdx, setRateIdx] = useState(1);
  const lr = overfitRates[rateIdx];
  const { train, test } = useMemo(() => {
    const rng = mulberry32(2024);
    const truth = (s: number) => 60 * (1 - Math.exp(-s / 45));
    const make = (n: number) => {
      const xs = Array.from({ length: n }, () => 10 + rng() * 90);
      return { xs, ys: xs.map((s) => truth(s) + normal(rng, 0, 6)) };
    };
    const tr = make(40);
    const te = make(400);
    const history = boost(tr.xs, tr.ys, OVERFIT_ROUNDS, lr);
    const trainMse = history.map((h) => h.sse / tr.xs.length);
    // Score the test stores round by round, adding one stump at a time.
    const base = tr.ys.reduce((a, b) => a + b, 0) / tr.ys.length;
    const testPred = te.xs.map(() => base);
    const testMse: number[] = [];
    const mse = () => testPred.reduce((a, p, i) => a + (te.ys[i] - p) ** 2, 0) / te.xs.length;
    testMse.push(mse());
    for (let r = 1; r <= OVERFIT_ROUNDS; r++) {
      const s = history[r].stump!;
      for (let i = 0; i < te.xs.length; i++) testPred[i] += lr * (te.xs[i] < s.threshold ? s.left : s.right);
      testMse.push(mse());
    }
    return { train: trainMse, test: testMse };
  }, [lr]);

  const best = test.indexOf(Math.min(...test));
  const W = 600;
  const SH = 260;
  const x = linear([0, OVERFIT_ROUNDS], [48, W - 70]);
  const yMax = Math.min(120, Math.max(...test.slice(5)) * 1.15);
  const y = linear([0, yMax], [SH - 34, 12]);
  const clip = (v: number) => y(Math.min(v, yMax));
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${clip(v).toFixed(1)}`).join("");

  return (
    <Panel
      title="40 training stores, 400 unseen test stores. Watch the two errors part ways."
      footer={
        <>
          Lowest test error at round <span className="font-semibold tabular">{best}</span> (test MSE{" "}
          {test[best].toFixed(1)}). After that, new trees mostly memorize the noise in the 40 training stores. Stopping
          there is called <em>early stopping</em>.
        </>
      }
    >
      <Slider id="bo-lr" label="Learning rate" value={rateIdx} min={0} max={overfitRates.length - 1} step={1} onChange={setRateIdx} display={(i) => String(overfitRates[i])} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--series-1)" label="Training error (stores the model saw)" shape="line" />
        <Key color="var(--series-2)" label="Test error (new stores)" shape="line" />
      </div>
      <svg viewBox={`0 0 ${W} ${SH}`} className="mt-2 w-full h-auto" role="img" aria-label="Training and test error by boosting round">
        <Axis scale={y} orient="left" at={48} gridTo={W - 70} label="mean squared error" />
        <Axis scale={x} orient="bottom" at={SH - 34} label="boosting round" />
        <line x1={x(best)} x2={x(best)} y1={12} y2={SH - 34} stroke="var(--ink-2)" />
        <text x={x(best) + 4} y={22} fontSize={11} fill="var(--ink)">
          early stop
        </text>
        <path d={line(train)} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <path d={line(test)} fill="none" stroke="var(--series-2)" strokeWidth={2} />
        <text x={W - 66} y={clip(train[OVERFIT_ROUNDS]) + 4} fontSize={11} fill="var(--ink-2)">
          train
        </text>
        <text x={W - 66} y={clip(test[OVERFIT_ROUNDS]) + 4} fontSize={11} fill="var(--ink-2)">
          test
        </text>
      </svg>
    </Panel>
  );
}

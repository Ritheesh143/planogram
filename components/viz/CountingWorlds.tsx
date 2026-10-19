"use client";

import { useMemo, useRef, useState } from "react";
import { countWorlds } from "@/lib/sim/prob";
import { mulberry32 } from "@/lib/sim/rng";
import { Key, Panel, Slider, Tip } from "./kit";

const COLS = 40;
const ROWS = 25;
const GAP = 12;
const R = 4.3;
const PAD = 8;
const VW = COLS * GAP + PAD * 2;
const VH = ROWS * GAP + PAD * 2;

type Kind = "caught" | "falseAlarm" | "missed" | "clear";

const COLORS: Record<Kind, string> = {
  caught: "var(--series-1)",
  falseAlarm: "var(--series-2)",
  missed: "var(--series-3)",
  clear: "var(--axis)",
};

const LABELS: Record<Kind, string> = {
  caught: "Fraud, flagged (caught)",
  falseAlarm: "Genuine, flagged (false alarm)",
  missed: "Fraud, not flagged (missed)",
  clear: "Genuine, not flagged",
};

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/** 1,000 returns drawn as dots, so Bayes' theorem becomes counting. */
export function CountingWorlds({
  initialBase = 0.01,
  initialSensitivity = 0.9,
  initialFalseAlarm = 0.05,
}: {
  initialBase?: number;
  initialSensitivity?: number;
  initialFalseAlarm?: number;
}) {
  const [base, setBase] = useState(initialBase);
  const [sens, setSens] = useState(initialSensitivity);
  const [fa, setFa] = useState(initialFalseAlarm);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const w = countWorlds(1000, base, sens, fa);
  const flagged = w.caught + w.falseAlarms;

  // Flagged returns first so the "only flagged" view reads as one block.
  const kinds = useMemo(() => {
    const out: Kind[] = [];
    for (let i = 0; i < w.caught; i++) out.push("caught");
    for (let i = 0; i < w.falseAlarms; i++) out.push("falseAlarm");
    for (let i = 0; i < w.missed; i++) out.push("missed");
    for (let i = 0; i < w.clear; i++) out.push("clear");
    return out;
  }, [w.caught, w.falseAlarms, w.missed, w.clear]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = VW / rect.width;
    const sx = (e.clientX - rect.left) * k - PAD;
    const sy = (e.clientY - rect.top) * k - PAD;
    const col = Math.floor(sx / GAP);
    const row = Math.floor(sy / GAP);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return setHover(null);
    const i = row * COLS + col;
    const box = wrap.current!.getBoundingClientRect();
    setHover({ i, x: rect.left - box.left + (PAD + col * GAP + GAP / 2) / k, y: rect.top - box.top + (PAD + row * GAP) / k });
  };

  return (
    <Panel
      title="1,000 returns at Bolt & Beam. Each dot is one return."
      footer={
        <>
          Dots are grouped by type so you can count them. In a real store the flagged ones are
          scattered through the day.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider id="cw-base" label="Fraud base rate" value={base} min={0.001} max={0.2} step={0.001} onChange={setBase} display={(v) => pct(v)} />
        <Slider id="cw-sens" label="Flag catches fraud (sensitivity)" value={sens} min={0.5} max={1} step={0.01} onChange={setSens} display={(v) => pct(v, 0)} />
        <Slider id="cw-fa" label="False-alarm rate on genuine" value={fa} min={0} max={0.2} step={0.005} onChange={setFa} display={(v) => pct(v)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {(Object.keys(LABELS) as Kind[]).map((k) => (
          <Key
            key={k}
            color={COLORS[k]}
            label={
              <>
                {LABELS[k]} <span className="font-semibold text-ink tabular">{k === "caught" ? w.caught : k === "falseAlarm" ? w.falseAlarms : k === "missed" ? w.missed : w.clear}</span>
              </>
            }
          />
        ))}
      </div>

      <div ref={wrap} className="relative mt-3">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${w.caught} caught, ${w.falseAlarms} false alarms, ${w.missed} missed, ${w.clear} genuine and clear`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {kinds.map((k, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const isFlagged = k === "caught" || k === "falseAlarm";
            return (
              <circle
                key={i}
                cx={PAD + col * GAP + GAP / 2}
                cy={PAD + row * GAP + GAP / 2}
                r={R}
                fill={COLORS[k]}
                opacity={onlyFlagged && !isFlagged ? 0.12 : k === "clear" ? 0.55 : 1}
                stroke={hover?.i === i ? "var(--ink)" : "none"}
                strokeWidth={1.5}
              />
            );
          })}
        </svg>
        {hover && kinds[hover.i] && (
          <Tip x={hover.x} y={hover.y}>
            Return #{hover.i + 1}: {LABELS[kinds[hover.i]]}
          </Tip>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOnlyFlagged((v) => !v)}
          aria-pressed={onlyFlagged}
          className={onlyFlagged ? "rounded-lg bg-accent px-3 py-1.5 text-sm text-white" : "rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent"}
        >
          {onlyFlagged ? "Show all returns" : "Show only flagged returns"}
        </button>
        <span className="text-sm text-ink-2">The manager only ever sees the flagged ones.</span>
      </div>

      <div className="mt-4 rounded-lg bg-surface-2 p-4" data-testid="cw-answer">
        <div className="text-sm text-ink-2">Of the flagged returns, how many are fraud?</div>
        <div className="mt-1 text-2xl font-semibold tabular">
          {w.caught} of {flagged} = {flagged ? pct(w.caught / flagged) : "—"}
        </div>
        <FlaggedBar caught={w.caught} falseAlarms={w.falseAlarms} />
        <div className="mt-2 text-xs text-muted">
          Exact Bayes answer without rounding to whole returns: {pct(w.posterior, 2)}
        </div>
      </div>

      <CountTree w={w} />
    </Panel>
  );
}

function FlaggedBar({ caught, falseAlarms }: { caught: number; falseAlarms: number }) {
  const total = caught + falseAlarms;
  if (!total) return null;
  const cw = (caught / total) * 100;
  return (
    <div className="mt-2 flex h-3 w-full gap-[2px] overflow-hidden rounded" aria-hidden>
      {caught > 0 && <div style={{ width: `${cw}%`, background: COLORS.caught }} className="rounded-l" />}
      {falseAlarms > 0 && <div style={{ width: `${100 - cw}%`, background: COLORS.falseAlarm }} className="rounded-r" />}
    </div>
  );
}

/** The same counts as a natural-frequency tree: the bridge from dots to the formula. */
function CountTree({ w }: { w: ReturnType<typeof countWorlds> }) {
  const node = (x: number, y: number, n: number, label: string, color?: string) => (
    <g>
      <rect x={x - 62} y={y - 18} width={124} height={36} rx={8} fill="var(--surface-1)" stroke="var(--grid)" />
      {color && <circle cx={x - 48} cy={y} r={5} fill={color} />}
      <text x={x + (color ? 6 : 0)} y={y - 2} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)" className="tabular">
        {n}
      </text>
      <text x={x + (color ? 6 : 0)} y={y + 12} textAnchor="middle" fontSize={10} fill="var(--ink-2)">
        {label}
      </text>
    </g>
  );
  const edge = (x1: number, y1: number, x2: number, y2: number, text: string) => (
    <g>
      <line x1={x1} y1={y1 + 18} x2={x2} y2={y2 - 18} stroke="var(--axis)" />
      <text x={(x1 + x2) / 2 + (x2 < x1 ? -8 : 8)} y={(y1 + y2) / 2 + 4} textAnchor={x2 < x1 ? "end" : "start"} fontSize={10} fill="var(--muted)">
        {text}
      </text>
    </g>
  );
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm font-medium">The same counts as a tree</div>
      <svg viewBox="0 0 640 210" className="w-full h-auto" role="img" aria-label="Natural frequency tree">
        {edge(320, 25, 170, 100, `${(w.fraud / w.total * 100).toFixed(1)}% fraud`)}
        {edge(320, 25, 470, 100, "the rest genuine")}
        {edge(170, 100, 90, 180, "flagged")}
        {edge(170, 100, 250, 180, "missed")}
        {edge(470, 100, 390, 180, "flagged")}
        {edge(470, 100, 550, 180, "clear")}
        {node(320, 25, w.total, "returns")}
        {node(170, 100, w.fraud, "fraud")}
        {node(470, 100, w.genuine, "genuine")}
        {node(90, 180, w.caught, "caught", COLORS.caught)}
        {node(250, 180, w.missed, "missed", COLORS.missed)}
        {node(390, 180, w.falseAlarms, "false alarms", COLORS.falseAlarm)}
        {node(550, 180, w.clear, "clear", COLORS.clear)}
      </svg>
    </div>
  );
}

/** Simulate random returns at growing scale: small samples are noisy, large ones settle on Bayes. */
export function FraudSimulation({ base = 0.01, sens = 0.9, fa = 0.05 }: { base?: number; sens?: number; fa?: number }) {
  const [seed, setSeed] = useState(1);
  const rows = useMemo(() => {
    const rng = mulberry32(seed * 9973);
    return [100, 1_000, 10_000, 100_000].map((n) => {
      let flagged = 0;
      let fraudFlagged = 0;
      for (let i = 0; i < n; i++) {
        const fraud = rng() < base;
        const flag = rng() < (fraud ? sens : fa);
        if (flag) {
          flagged++;
          if (fraud) fraudFlagged++;
        }
      }
      return { n, flagged, fraudFlagged };
    });
  }, [seed, base, sens, fa]);
  const exact = countWorlds(1000, base, sens, fa).posterior;
  return (
    <Panel title="Simulate random returns instead of counting perfect ones">
      <table className="w-full text-sm tabular" data-testid="fraud-sim">
        <thead className="text-left text-xs text-ink-2">
          <tr>
            <th className="py-1 pr-3 font-medium">Returns simulated</th>
            <th className="py-1 pr-3 font-medium">Flagged</th>
            <th className="py-1 pr-3 font-medium">Fraud among flagged</th>
            <th className="py-1 font-medium">Share that is fraud</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n}>
              <td className="border-t border-line py-1 pr-3">{r.n.toLocaleString("en-US")}</td>
              <td className="border-t border-line py-1 pr-3">{r.flagged.toLocaleString("en-US")}</td>
              <td className="border-t border-line py-1 pr-3">{r.fraudFlagged.toLocaleString("en-US")}</td>
              <td className="border-t border-line py-1">{r.flagged ? pct(r.fraudFlagged / r.flagged) : "—"}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border-t border-line py-1 pr-3" colSpan={3}>
              Bayes&apos; formula
            </td>
            <td className="border-t border-line py-1">{pct(exact, 2)}</td>
          </tr>
        </tbody>
      </table>
      <button type="button" onClick={() => setSeed((s) => s + 1)} className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white">
        Simulate again with fresh randomness
      </button>
    </Panel>
  );
}

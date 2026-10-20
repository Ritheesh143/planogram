"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { setDepth, setMastered, useProgress } from "@/lib/progress";
import { AskClaude } from "./AskClaude";
import { DepthSummary } from "./DepthSummary";
import { LessonContext } from "./LessonContext";
import { sectionsFor, type LessonKind } from "./sections";

type Props = {
  slug: string;
  kind: LessonKind;
  title: string;
  aisleName: string;
  aisleNumber: string;
  keystone?: number;
  minutes?: number;
  week?: number;
  summary: string;
  prereqs: { title: string; href: string }[];
  keyIdeas: { front: string; back: string }[];
  children: ReactNode;
};

const depths = [
  { level: 1 as const, label: "L1 Intuition", hint: "Story, numbers and pictures" },
  { level: 2 as const, label: "L2 Derivation", hint: "Adds step-by-step math" },
  { level: 3 as const, label: "L3 Rigor", hint: "Adds proofs and edge cases" },
];

export function LessonShell(props: Props) {
  const progress = useProgress();
  const lp = progress.lessons[props.slug];
  const done = new Set(lp?.sections ?? []);
  const mastered = lp?.mastered ?? false;

  return (
    <LessonContext.Provider value={{ slug: props.slug, kind: props.kind }}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_220px]">
        <article className="min-w-0" data-depth={progress.depth}>
          <nav className="text-xs text-muted">
            <Link href="/" className="hover:text-ink">
              Store map
            </Link>{" "}
            / Aisle {props.aisleNumber} · {props.aisleName}
          </nav>
          {props.kind === "model" && (
            <div className="mt-4 text-xs font-semibold tracking-wide text-accent">MODEL LAB</div>
          )}
          {props.keystone && (
            <div className="mt-4 text-xs font-semibold tracking-wide text-accent">
              KEYSTONE {props.keystone}
            </div>
          )}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{props.title}</h1>
          <p className="mt-2 text-ink-2">{props.summary}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {props.minutes && <span>About {props.minutes} minutes</span>}
            {props.week && <span>Sprint week {props.week}</span>}
            {props.prereqs.length > 0 && (
              <span>
                Builds on{" "}
                {props.prereqs.map((p, i) => (
                  <span key={p.href}>
                    {i > 0 && ", "}
                    <Link className="text-accent hover:underline" href={p.href}>
                      {p.title}
                    </Link>
                  </span>
                ))}
              </span>
            )}
          </div>

          <div
            className="no-print mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-1 p-2"
            role="radiogroup"
            aria-label="Depth"
          >
            <span className="px-2 text-xs text-muted">Depth</span>
            {depths.map((d) => (
              <button
                key={d.level}
                type="button"
                role="radio"
                aria-checked={progress.depth === d.level}
                onClick={() => setDepth(d.level)}
                title={d.hint}
                className={
                  progress.depth === d.level
                    ? "rounded-lg bg-accent px-3 py-1.5 text-sm text-white"
                    : "rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2"
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          <DepthSummary kind={props.kind} />

          <div className="lesson-body mt-6">{props.children}</div>

          <div className="no-print mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-1 p-4">
            <div className="flex-1 text-sm text-ink-2">
              {mastered
                ? "Marked as mastered. It will still come back in your review deck."
                : "Can you explain this to a colleague without notes, and solve the hard exercise? Then mark it mastered."}
            </div>
            <button
              type="button"
              onClick={() => setMastered(props.slug, !mastered)}
              className={
                mastered
                  ? "rounded-lg border border-line px-4 py-2 text-sm"
                  : "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              }
            >
              {mastered ? "Unmark mastered" : "Mark as mastered"}
            </button>
          </div>

          <AskClaude kind={props.kind} title={props.title} summary={props.summary} keyIdeas={props.keyIdeas} />
        </article>

        <aside className="no-print hidden lg:block">
          <div className="sticky top-20">
            <div className="text-xs font-medium tracking-widest text-muted">{props.kind === "model" ? "ON THIS MODEL" : "IN THIS LESSON"}</div>
            <ol className="mt-3 space-y-1 text-sm">
              {sectionsFor(props.kind).map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <span
                      aria-hidden
                      className={
                        done.has(s.id)
                          ? "grid h-4 w-4 place-items-center rounded-full bg-good text-[10px] text-white"
                          : "h-4 w-4 rounded-full border border-axis"
                      }
                    >
                      {done.has(s.id) ? "✓" : ""}
                    </span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </LessonContext.Provider>
  );
}

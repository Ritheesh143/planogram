"use client";

import Link from "next/link";
import { useState } from "react";
import { toggleExercise, useProgress } from "@/lib/progress";

type Item = { slug: string; n: number; level: string; title: string; lesson: string; aisle: string; href: string };
type Level = "all" | "easy" | "medium" | "hard";

const tone: Record<string, string> = { easy: "text-good", medium: "text-accent", hard: "text-critical" };

export function ExerciseList({ items, aisles }: { items: Item[]; aisles: { id: string; name: string; number: string }[] }) {
  const progress = useProgress();
  const [level, setLevel] = useState<Level>("all");
  const [hideDone, setHideDone] = useState(false);
  const id = (i: Item) => `${i.slug}#${i.n}`;
  const shown = items.filter((i) => (level === "all" || i.level === level) && (!hideDone || !progress.exercises.includes(id(i))));
  const doneCount = items.filter((i) => progress.exercises.includes(id(i))).length;
  const lessons = [...new Set(shown.map((i) => i.slug))];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="radiogroup" aria-label="Difficulty">
          {(["all", "easy", "medium", "hard"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              className={level === l ? "rounded-lg bg-accent px-3 py-1 text-sm text-white" : "rounded-lg border border-line px-3 py-1 text-sm"}
            >
              {l === "all" ? "All" : l[0].toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
        <label className="ml-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide done
        </label>
        <span className="ml-auto text-sm text-ink-2 tabular" data-testid="ex-done">
          {doneCount} of {items.length} done
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {aisles.map((a) => {
          const inAisle = lessons.filter((s) => shown.find((i) => i.slug === s)!.aisle === a.id);
          if (!inAisle.length) return null;
          return (
            <section key={a.id}>
              <h2 className="text-xs font-medium tracking-widest text-muted">
                AISLE {a.number} · {a.name.toUpperCase()}
              </h2>
              <div className="mt-2 space-y-3">
                {inAisle.map((s) => {
                  const ex = shown.filter((i) => i.slug === s);
                  return (
                    <div key={s} className="rounded-xl border border-line bg-surface-1 p-3">
                      <Link href={ex[0].href} className="font-medium hover:text-accent">
                        {ex[0].lesson}
                      </Link>
                      <ul className="mt-2 space-y-1">
                        {ex.map((i) => (
                          <li key={id(i)} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              aria-label={`Mark "${i.title}" done`}
                              checked={progress.exercises.includes(id(i))}
                              onChange={() => toggleExercise(id(i))}
                              data-testid={`ex-${i.slug}-${i.n}`}
                            />
                            <span className="w-6 text-xs text-muted tabular">{i.n}</span>
                            <span className={`w-14 text-xs font-medium uppercase tracking-wide ${tone[i.level]}`}>{i.level}</span>
                            <Link href={i.href} className="flex-1 hover:text-accent">
                              {i.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

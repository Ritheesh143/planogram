"use client";

import Link from "next/link";
import { lessonStatus, useProgress } from "@/lib/progress";

type Step = { slug: string; title: string; href: string; ready: boolean; week?: number };
type ThreadView = { id: string; name: string; idea: string; steps: Step[] };

export function ThreadsView({ threads }: { threads: ThreadView[] }) {
  const progress = useProgress();
  return (
    <div className="space-y-5">
      {threads.map((t) => {
        const ready = t.steps.filter((s) => s.ready).length;
        const mastered = t.steps.filter((s) => lessonStatus(progress, s.slug) === "mastered").length;
        return (
          <section key={t.id} id={t.id} className="scroll-mt-20 rounded-xl border border-line bg-surface-1 p-4" data-testid={`thread-${t.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{t.name}</h2>
              <span className="text-xs text-muted tabular">
                {mastered} of {t.steps.length} mastered · {ready} ready
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-2">{t.idea}</p>
            <ol className="relative mt-4 space-y-3 border-l-2 border-line pl-5">
              {t.steps.map((s, i) => {
                const st = lessonStatus(progress, s.slug);
                return (
                  <li key={s.slug} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[27px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 ${
                        st === "mastered" ? "border-accent bg-accent" : s.ready ? "border-accent bg-surface-1" : "border-axis bg-surface-1"
                      }`}
                    />
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs text-muted tabular">{i + 1}</span>
                      <Link href={s.href} className={s.ready ? "font-medium hover:text-accent" : "text-ink-2 hover:text-ink"}>
                        {s.title}
                      </Link>
                      <span className="text-xs text-muted">
                        {s.ready ? (st === "mastered" ? "Mastered" : st === "started" ? "In progress" : "Ready") : "Planned"}
                        {s.week ? ` · week ${s.week}` : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

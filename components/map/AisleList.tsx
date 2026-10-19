"use client";

import Link from "next/link";
import type { Aisle, Lesson } from "@/lib/curriculum";
import { lessonStatus, useProgress } from "@/lib/progress";

type Props = {
  aisles: Aisle[];
  lessons: (Lesson & { href: string })[];
};

const badge = {
  new: "border border-accent text-accent",
  started: "bg-accent-wash text-accent",
  mastered: "bg-accent text-white",
};

const badgeText = { new: "Ready", started: "In progress", mastered: "Mastered" };

// Text view of the store map: every lesson, its status and sprint week.
export function AisleList({ aisles, lessons }: Props) {
  const progress = useProgress();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {aisles.map((a) => (
        <section key={a.id} className="rounded-xl border border-line bg-surface-1 p-4">
          <h3 className="text-xs font-medium tracking-widest text-muted">AISLE {a.number}</h3>
          <div className="font-semibold">{a.name}</div>
          <p className="mt-0.5 text-sm text-ink-2">{a.tagline}</p>
          <ul className="mt-3 divide-y divide-line">
            {lessons
              .filter((l) => l.aisle === a.id)
              .map((l) => {
                const s = lessonStatus(progress, l.slug);
                return (
                  <li key={l.slug} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="w-10 shrink-0 text-xs text-muted tabular">
                      {l.week ? `Wk ${l.week}` : ""}
                    </span>
                    <Link
                      href={l.href}
                      className={
                        l.status === "ready"
                          ? "flex-1 hover:text-accent"
                          : "flex-1 text-ink-2 hover:text-ink"
                      }
                    >
                      {l.keystone && <span className="mr-1 font-semibold">K{l.keystone}</span>}
                      {l.title}
                    </Link>
                    {l.status === "ready" ? (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${badge[s]}`}>
                        {badgeText[s]}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] text-muted">Planned</span>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

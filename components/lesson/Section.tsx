"use client";

import type { ReactNode } from "react";
import { toggleSection, useProgress } from "@/lib/progress";
import { ASK_EVENT } from "./AskClaude";
import { useLessonKind, useLessonSlug } from "./LessonContext";
import { sectionsFor, type SectionId } from "./sections";

export function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const slug = useLessonSlug();
  const sections = sectionsFor(useLessonKind());
  const progress = useProgress();
  const meta = sections.find((s) => s.id === id)!;
  const index = sections.findIndex((s) => s.id === id) + 1;
  const done = progress.lessons[slug]?.sections.includes(id) ?? false;

  return (
    <section id={id} className="scroll-mt-20 border-t border-line pt-8 mt-10 first:mt-0 first:border-0 first:pt-0">
      <header className="mb-4 flex items-center gap-3">
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-lg">
          {meta.icon}
        </span>
        <div className="flex-1">
          <div className="text-xs text-muted tabular">Section {index} of {sections.length}</div>
          <h2 className="text-xl font-semibold tracking-tight">{meta.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: id }))}
          className="no-print text-xs text-accent hover:underline"
          aria-label={`Ask Claude about ${meta.title}`}
        >
          Ask Claude
        </button>
        <label className="no-print flex cursor-pointer items-center gap-2 text-xs text-ink-2">
          <input type="checkbox" checked={done} onChange={() => toggleSection(slug, id)} className="h-4 w-4 accent-[var(--good)]" />
          Done
        </label>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

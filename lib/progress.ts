"use client";

import { useSyncExternalStore } from "react";

// All learner state lives in this browser only. It is never sent anywhere.

export type LessonProgress = {
  sections: string[];
  mastered: boolean;
  updatedAt: string;
};

export type StoredCard = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
};

export type CheckAttempt = {
  date: string;
  answers: Record<string, string>;
  score: number;
  total: number;
};

export type HoursEntry = { date: string; hours: number; note: string };

export type PlanState = {
  /** First day of sprint week 1 (YYYY-MM-DD), chosen by the learner. */
  start?: string;
  /** Ids of finished career tasks and milestones from content/plan.ts. */
  done: string[];
  hours: HoursEntry[];
};

export type Progress = {
  version: 1;
  lessons: Record<string, LessonProgress>;
  cards: Record<string, StoredCard>;
  checks: CheckAttempt[];
  depth: 1 | 2 | 3;
  plan: PlanState;
  /** Pen-and-paper exercises marked done, as "slug#n". */
  exercises: string[];
};

const KEY = "planogram:v1";
const EVENT = "planogram:progress";

export const emptyProgress: Progress = {
  version: 1,
  lessons: {},
  cards: {},
  checks: [],
  depth: 2,
  plan: { done: [], hours: [] },
  exercises: [],
};

let cachedRaw: string | null | undefined;
let cachedValue: Progress = emptyProgress;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function loadProgress(): Progress {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    // Fields added after a learner's first visit fall back to their defaults.
    const parsed = raw ? (JSON.parse(raw) as Partial<Progress>) : null;
    cachedValue = parsed ? { ...emptyProgress, ...parsed, plan: { ...emptyProgress.plan, ...parsed.plan } } : emptyProgress;
  } catch {
    cachedValue = emptyProgress;
  }
  return cachedValue;
}

export function updateProgress(fn: (p: Progress) => Progress): void {
  const next = fn(loadProgress());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode): keep the in-memory value for this visit.
    cachedRaw = JSON.stringify(next);
    cachedValue = next;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, loadProgress, () => emptyProgress);
}

export function toggleSection(slug: string, section: string): void {
  updateProgress((p) => {
    const cur = p.lessons[slug] ?? { sections: [], mastered: false, updatedAt: "" };
    const sections = cur.sections.includes(section)
      ? cur.sections.filter((s) => s !== section)
      : [...cur.sections, section];
    return {
      ...p,
      lessons: { ...p.lessons, [slug]: { ...cur, sections, updatedAt: new Date().toISOString() } },
    };
  });
}

export function setMastered(slug: string, mastered: boolean): void {
  updateProgress((p) => {
    const cur = p.lessons[slug] ?? { sections: [], mastered: false, updatedAt: "" };
    return {
      ...p,
      lessons: { ...p.lessons, [slug]: { ...cur, mastered, updatedAt: new Date().toISOString() } },
    };
  });
}

export function setDepth(depth: 1 | 2 | 3): void {
  updateProgress((p) => ({ ...p, depth }));
}

export type LessonStatus = "new" | "started" | "mastered";

export function lessonStatus(p: Progress, slug: string): LessonStatus {
  const l = p.lessons[slug];
  if (!l) return "new";
  if (l.mastered) return "mastered";
  return l.sections.length > 0 ? "started" : "new";
}

export function toggleExercise(id: string): void {
  updateProgress((p) => ({
    ...p,
    exercises: p.exercises.includes(id) ? p.exercises.filter((e) => e !== id) : [...p.exercises, id],
  }));
}

export function togglePlanItem(id: string): void {
  updateProgress((p) => ({
    ...p,
    plan: { ...p.plan, done: p.plan.done.includes(id) ? p.plan.done.filter((d) => d !== id) : [...p.plan.done, id] },
  }));
}

export function setSprintStart(date: string): void {
  updateProgress((p) => ({ ...p, plan: { ...p.plan, start: date } }));
}

export function logHours(entry: HoursEntry): void {
  updateProgress((p) => ({ ...p, plan: { ...p.plan, hours: [...p.plan.hours, entry] } }));
}

export function removeHours(index: number): void {
  updateProgress((p) => ({ ...p, plan: { ...p.plan, hours: p.plan.hours.filter((_, i) => i !== index) } }));
}

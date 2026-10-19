import { z } from "zod";
import { aisles, lessons, threads } from "@/content/curriculum";

export const AisleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  number: z.string(),
  name: z.string(),
  tagline: z.string(),
});

export const LessonSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  aisle: z.string(),
  title: z.string(),
  kind: z.enum(["lesson", "model"]),
  status: z.enum(["ready", "planned"]),
  keystone: z.number().int().min(1).max(4).optional(),
  week: z.number().int().min(1).max(16).optional(),
  minutes: z.number().int().positive().optional(),
  summary: z.string(),
  prereqs: z.array(z.string()),
});

export const ThreadSchema = z.object({
  id: z.string(),
  name: z.string(),
  idea: z.string(),
  steps: z.array(z.string()).min(2),
});

export type Aisle = z.infer<typeof AisleSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Thread = z.infer<typeof ThreadSchema>;

export const allAisles: Aisle[] = z.array(AisleSchema).parse(aisles);
export const allLessons: Lesson[] = z.array(LessonSchema).parse(lessons);
export const allThreads: Thread[] = z.array(ThreadSchema).parse(threads);

const bySlug = new Map(allLessons.map((l) => [l.slug, l]));

export function getLesson(slug: string): Lesson | undefined {
  return bySlug.get(slug);
}

export function lessonsInAisle(aisleId: string): Lesson[] {
  return allLessons.filter((l) => l.aisle === aisleId);
}

export function getAisle(id: string): Aisle | undefined {
  return allAisles.find((a) => a.id === id);
}

export function lessonHref(lesson: Lesson): string {
  return lesson.kind === "model"
    ? `/models/${lesson.slug}`
    : `/learn/${lesson.aisle}/${lesson.slug}`;
}

/** Lessons that list `slug` as a prerequisite: what this lesson unlocks. */
export function unlockedBy(slug: string): Lesson[] {
  return allLessons.filter((l) => l.prereqs.includes(slug));
}

export function threadsThrough(slug: string): Thread[] {
  return allThreads.filter((t) => t.steps.includes(slug));
}

export const keystones = allLessons
  .filter((l) => l.keystone !== undefined)
  .sort((a, b) => (a.keystone ?? 0) - (b.keystone ?? 0));

/**
 * Structural problems in the curriculum: duplicate slugs, unknown aisles,
 * dangling prerequisites or thread steps, and prerequisite cycles.
 */
export function validateCurriculum(
  ls: Lesson[] = allLessons,
  as: Aisle[] = allAisles,
  ts: Thread[] = allThreads,
): string[] {
  const problems: string[] = [];
  const slugs = new Set<string>();
  for (const l of ls) {
    if (slugs.has(l.slug)) problems.push(`duplicate slug: ${l.slug}`);
    slugs.add(l.slug);
  }
  const aisleIds = new Set(as.map((a) => a.id));
  for (const l of ls) {
    if (!aisleIds.has(l.aisle)) problems.push(`${l.slug}: unknown aisle ${l.aisle}`);
    for (const p of l.prereqs) {
      if (!slugs.has(p)) problems.push(`${l.slug}: unknown prereq ${p}`);
    }
  }
  for (const t of ts) {
    for (const s of t.steps) {
      if (!slugs.has(s)) problems.push(`thread ${t.id}: unknown step ${s}`);
    }
  }

  // Depth-first search for prerequisite cycles.
  const state = new Map<string, "visiting" | "done">();
  const prereqs = new Map(ls.map((l) => [l.slug, l.prereqs]));
  const visit = (slug: string, path: string[]): void => {
    const s = state.get(slug);
    if (s === "done") return;
    if (s === "visiting") {
      problems.push(`cycle: ${[...path, slug].join(" -> ")}`);
      return;
    }
    state.set(slug, "visiting");
    for (const p of prereqs.get(slug) ?? []) visit(p, [...path, slug]);
    state.set(slug, "done");
  };
  for (const l of ls) visit(l.slug, []);
  return problems;
}

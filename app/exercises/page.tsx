import type { Metadata } from "next";
import { ExerciseList } from "@/components/plan/ExerciseList";
import exercises from "@/content/exercises.generated.json";
import { allAisles, getLesson, lessonHref } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Exercises",
  description: "Every pen-and-paper problem in one place, with worked solutions in each lesson.",
};

export default function ExercisesPage() {
  const items = exercises
    .map((e) => {
      const l = getLesson(e.slug);
      return l && l.status === "ready" ? { ...e, lesson: l.title, aisle: l.aisle, href: `${lessonHref(l)}#paper` } : null;
    })
    .filter((e) => e !== null);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-xs font-medium tracking-widest text-muted">THE WORKBENCH</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Exercises</h1>
      <p className="mt-2 text-ink-2">
        {items.length} pen-and-paper problems from {new Set(items.map((i) => i.slug)).size} lessons. Do them with a pen before opening the worked solution in the
        lesson; tick them off here.
      </p>
      <div className="mt-6">
        <ExerciseList items={items} aisles={allAisles.map((a) => ({ id: a.id, name: a.name, number: a.number }))} />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { cardsForLesson } from "@/content/cards";
import { lessonBodies } from "@/content/registry";
import { LessonShell } from "@/components/lesson/LessonShell";
import { PlannedLesson } from "@/components/lesson/PlannedLesson";
import { Recall } from "@/components/lesson/Recall";
import { Section } from "@/components/lesson/Section";
import { ThreadsPanel } from "@/components/lesson/ThreadsPanel";
import { getAisle, getLesson, lessonHref, threadsThrough, unlockedBy } from "@/lib/curriculum";

/** Renders a lesson or model page: the MDX body for ready lessons, a placeholder for planned ones. */
export async function renderLessonPage(slug: string) {
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  const aisle = getAisle(lesson.aisle)!;
  const prereqs = lesson.prereqs.map((p) => {
    const l = getLesson(p)!;
    return { title: l.title, href: lessonHref(l), ready: l.status === "ready" };
  });

  const load = lessonBodies[slug];
  if (lesson.status !== "ready" || !load) {
    return (
      <PlannedLesson lesson={lesson} aisleName={aisle.name} aisleNumber={aisle.number} prereqs={prereqs} />
    );
  }

  const { default: Body } = await load();
  const threads = threadsThrough(slug).map((t) => ({
    name: t.name,
    idea: t.idea,
    steps: t.steps.map((s) => {
      const l = getLesson(s)!;
      return { title: l.title, href: lessonHref(l), ready: l.status === "ready", current: s === slug };
    }),
  }));
  const unlocks = unlockedBy(slug).map((l) => ({
    title: l.title,
    href: lessonHref(l),
    ready: l.status === "ready",
  }));

  return (
    <LessonShell
      slug={slug}
      kind={lesson.kind}
      title={lesson.title}
      aisleName={aisle.name}
      aisleNumber={aisle.number}
      keystone={lesson.keystone}
      minutes={lesson.minutes}
      week={lesson.week}
      summary={lesson.summary}
      prereqs={prereqs}
    >
      <Body />
      <Section id="recall">
        <ThreadsPanel threads={threads} unlocks={unlocks} />
        <Recall cards={cardsForLesson(slug)} />
      </Section>
    </LessonShell>
  );
}

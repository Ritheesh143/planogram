import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allLessons, getLesson } from "@/lib/curriculum";
import { renderLessonPage } from "@/lib/lessonPage";

type Params = { aisle: string; lesson: string };

export function generateStaticParams(): Params[] {
  return allLessons
    .filter((l) => l.kind === "lesson")
    .map((l) => ({ aisle: l.aisle, lesson: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lesson } = await params;
  const l = getLesson(lesson);
  return { title: l?.title, description: l?.summary };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { aisle, lesson } = await params;
  const l = getLesson(lesson);
  if (!l || l.kind !== "lesson" || l.aisle !== aisle) notFound();
  return renderLessonPage(lesson);
}

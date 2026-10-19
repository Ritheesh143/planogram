import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allLessons, getLesson } from "@/lib/curriculum";
import { renderLessonPage } from "@/lib/lessonPage";

type Params = { model: string };

export function generateStaticParams(): Params[] {
  return allLessons.filter((l) => l.kind === "model").map((l) => ({ model: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { model } = await params;
  const l = getLesson(model);
  return { title: l?.title, description: l?.summary };
}

export default async function ModelPage({ params }: { params: Promise<Params> }) {
  const { model } = await params;
  const l = getLesson(model);
  if (!l || l.kind !== "model") notFound();
  return renderLessonPage(model);
}

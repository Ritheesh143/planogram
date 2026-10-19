import type { Metadata } from "next";
import { ConceptGraph } from "@/components/graph/ConceptGraph";
import { allAisles, allLessons, lessonHref } from "@/lib/curriculum";
import { layoutGraph } from "@/lib/graphLayout";

export const metadata: Metadata = {
  title: "Concept Graph",
  description: "Every lesson and its prerequisites, laid out left to right.",
};

export default function GraphPage() {
  const layout = layoutGraph(
    allLessons.map((l) => ({ id: l.slug, group: l.aisle, prereqs: l.prereqs })),
    allAisles.map((a) => a.id),
  );
  const lessons = allLessons.map((l) => {
    const p = layout.nodes.get(l.slug)!;
    return { slug: l.slug, title: l.title, aisle: l.aisle, href: lessonHref(l), ready: l.status === "ready", prereqs: l.prereqs, x: p.x, y: p.y };
  });
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-medium tracking-widest text-muted">STORE BLUEPRINT</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Concept Graph</h1>
      <p className="mt-2 max-w-3xl text-ink-2">
        Every lesson sits one column to the right of its deepest prerequisite, so you can read the whole curriculum left to right: what you need first, and
        what each idea unlocks. Scroll sideways to follow a path from the Keystones to agents.
      </p>
      <div className="mt-6">
        <ConceptGraph lessons={lessons} aisles={allAisles.map((a) => ({ id: a.id, name: a.name }))} width={layout.width} height={layout.height} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { ThreadsView } from "@/components/graph/ThreadsView";
import { allThreads, getLesson, lessonHref } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Golden Threads",
  description: "The same piece of math, reappearing across retail problems, models and agents.",
};

export default function ThreadsPage() {
  const threads = allThreads.map((t) => ({
    id: t.id,
    name: t.name,
    idea: t.idea,
    steps: t.steps.map((s) => {
      const l = getLesson(s)!;
      return { slug: s, title: l.title, href: lessonHref(l), ready: l.status === "ready", week: l.week };
    }),
  }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-xs font-medium tracking-widest text-muted">GOLDEN THREADS</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">The same math in different clothes</h1>
      <p className="mt-2 text-ink-2">
        A handful of ideas carry most of the curriculum. Squared error, cross-entropy and Tweedie are one idea (likelihood). Ridge, shrinkage and
        hierarchical models are another (priors). Follow a thread and each new lesson is a familiar idea in a new setting.
      </p>
      <div className="mt-6">
        <ThreadsView threads={threads} />
      </div>
    </div>
  );
}

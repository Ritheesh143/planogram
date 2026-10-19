import type { Metadata } from "next";
import { PlanView } from "@/components/plan/PlanView";
import { allLessons, lessonHref } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Plan",
  description: "The 16-week sprint and the 24-month marathon, with an hours log.",
};

export default function PlanPage() {
  const lessons = allLessons
    .filter((l) => l.week !== undefined)
    .map((l) => ({ slug: l.slug, title: l.title, href: lessonHref(l), ready: l.status === "ready", week: l.week! }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-xs font-medium tracking-widest text-muted">STORE OPERATIONS</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Plan</h1>
      <p className="mt-2 text-ink-2">
        Sixteen weeks to an offer in hand for a Senior Data Scientist or Applied Scientist role, then two years of building the record that earns the
        next jump. Everything here is saved only in this browser.
      </p>
      <div className="mt-6">
        <PlanView lessons={lessons} />
      </div>
    </div>
  );
}

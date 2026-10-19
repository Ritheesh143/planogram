import Link from "next/link";
import type { Lesson } from "@/lib/curriculum";

type Props = {
  lesson: Lesson;
  aisleName: string;
  aisleNumber: string;
  prereqs: { title: string; href: string; ready: boolean }[];
};

export function PlannedLesson({ lesson, aisleName, aisleNumber, prereqs }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Store map
        </Link>{" "}
        / Aisle {aisleNumber} · {aisleName}
      </nav>
      <div className="mt-4 inline-block rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
        Planned{lesson.week ? ` · arrives before sprint week ${lesson.week}` : ""}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
      <p className="mt-3 text-ink-2">{lesson.summary}</p>
      <p className="mt-6 text-sm text-ink-2">
        This bay is still being stocked. Lessons are written about a week ahead of your sprint
        schedule, in the same template as the Keystones.
      </p>
      {prereqs.length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-surface-1 p-4">
          <div className="text-sm font-medium">Get ready by finishing</div>
          <ul className="mt-2 space-y-1 text-sm">
            {prereqs.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className={p.ready ? "text-accent hover:underline" : "text-ink-2 hover:text-ink"}>
                  {p.title}
                </Link>
                {!p.ready && <span className="text-muted"> (planned)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { checkQuestions, misconceptions } from "@/content/checks";
import { getLesson, lessonHref } from "@/lib/curriculum";
import { scoreCheck } from "@/lib/check";
import { updateProgress, useProgress } from "@/lib/progress";

export function FloorCheck() {
  const progress = useProgress();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const answered = Object.keys(answers).length;
  const result = scoreCheck(answers);

  const submit = () => {
    setSubmitted(true);
    updateProgress((p) => ({
      ...p,
      checks: [...p.checks, { date: new Date().toISOString(), answers, score: result.score, total: result.total }],
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const retake = () => {
    setAnswers({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      {submitted && (
        <div className="rounded-xl border border-line bg-surface-1 p-5" data-testid="check-result">
          <div className="text-sm text-ink-2">Your floor today</div>
          <div className="mt-1 text-3xl font-semibold tabular">
            {result.score} of {result.total}
          </div>
          {result.findings.length > 0 ? (
            <div className="mt-4">
              <div className="text-sm font-medium">What your answers reveal, and where to fix it</div>
              <ul className="mt-2 space-y-3">
                {result.findings.map((f) => {
                  const m = misconceptions.find((x) => x.id === f.misconception)!;
                  const lesson = getLesson(f.lesson)!;
                  return (
                    <li key={`${f.misconception}-${f.lesson}`} className="rounded-lg bg-surface-2 p-3 text-sm">
                      <div className="font-medium">{m.name}</div>
                      <p className="mt-0.5 text-ink-2">{m.explain}</p>
                      <Link href={lessonHref(lesson)} className="mt-1 inline-block text-accent hover:underline">
                        Fix it in: {lesson.title} →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-good">No misconceptions detected. Your floor is solid on these four Keystones.</p>
          )}
          <button type="button" onClick={retake} className="mt-4 rounded-lg border border-line px-4 py-2 text-sm hover:border-accent">
            Retake later
          </button>
        </div>
      )}

      <ol className="space-y-4">
        {checkQuestions.map((q, i) => {
          const pick = answers[q.id];
          return (
            <li key={q.id} className="rounded-xl border border-line bg-surface-1 p-4">
              <fieldset disabled={submitted}>
                <legend className="text-xs font-medium tracking-wide text-muted">
                  {i + 1}. {q.topic.toUpperCase()}
                </legend>
                <p className="mt-1 font-medium">{q.prompt}</p>
                <div className="mt-3 grid gap-2">
                  {q.options.map((o) => {
                    const chosen = pick === o.id;
                    const reveal = submitted && (chosen || o.correct);
                    return (
                      <label
                        key={o.id}
                        className={[
                          "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                          reveal && o.correct ? "border-good" : "",
                          reveal && chosen && !o.correct ? "border-critical" : "",
                          !reveal ? (chosen ? "border-accent bg-accent-wash" : "border-line hover:border-accent") : "",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={o.id}
                          checked={chosen}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                          className="mt-0.5"
                        />
                        <span className="flex-1">
                          {o.text}
                          {reveal && o.correct && <span className="ml-2 text-good">✓ correct</span>}
                          {reveal && chosen && !o.correct && <span className="ml-2 text-critical">✗ your answer</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {submitted && (
                  <p className="mt-3 text-sm text-ink-2">
                    {q.explain}{" "}
                    <Link href={lessonHref(getLesson(q.lesson)!)} className="text-accent hover:underline">
                      Lesson →
                    </Link>
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!submitted && (
        <div className="sticky bottom-4 flex items-center gap-3 rounded-xl border border-line bg-surface-1 p-3 shadow-lg">
          <span className="flex-1 text-sm text-ink-2 tabular">
            {answered} of {checkQuestions.length} answered. Pick &quot;Not sure&quot; rather than guessing.
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={answered < checkQuestions.length}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            See my floor
          </button>
        </div>
      )}

      <CheckHistory attempts={progress.checks} />
    </div>
  );
}

function CheckHistory({ attempts }: { attempts: { date: string; score: number; total: number }[] }) {
  if (attempts.length === 0) return null;
  return (
    <section className="rounded-xl border border-line bg-surface-1 p-4">
      <h2 className="text-sm font-medium">Your Floor Check history</h2>
      <ul className="mt-3 space-y-2">
        {attempts.map((a) => (
          <li key={a.date} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-ink-2 tabular">
              {new Date(a.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded bg-surface-2">
              <span className="block h-full rounded-r bg-accent" style={{ width: `${(a.score / a.total) * 100}%` }} />
            </span>
            <span className="w-14 text-right font-medium tabular">
              {a.score}/{a.total}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

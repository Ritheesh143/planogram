"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cards } from "@/content/cards";
import { allLessons, getLesson, lessonHref } from "@/lib/curriculum";
import { updateProgress, useProgress } from "@/lib/progress";
import { isDue, newCard, previewIntervals, Rating, review } from "@/lib/srs";
import { refreshNow, useNow } from "@/lib/useNow";
import type { Grade } from "ts-fsrs";

const grades: { grade: Grade; label: string; hint: string }[] = [
  { grade: Rating.Again, label: "Again", hint: "I didn't know it" },
  { grade: Rating.Hard, label: "Hard", hint: "Got it, with effort" },
  { grade: Rating.Good, label: "Good", hint: "Got it" },
  { grade: Rating.Easy, label: "Easy", hint: "Instant" },
];

export function ReviewQueue() {
  const progress = useProgress();
  const [revealed, setRevealed] = useState(false);
  const nowMs = useNow();

  const deck = useMemo(
    () => cards.filter((c) => progress.cards[c.id]),
    [progress.cards],
  );
  const now = new Date(nowMs ?? 0);
  const due = deck
    .filter((c) => nowMs !== null && isDue(progress.cards[c.id], now))
    .sort((a, b) => progress.cards[a.id].due.localeCompare(progress.cards[b.id].due));
  const current = due[0];

  const readyCards = cards.filter((c) => getLesson(c.lesson)?.status === "ready");
  const notInDeck = readyCards.filter((c) => !progress.cards[c.id]);

  const addAll = () =>
    updateProgress((p) => {
      const next = { ...p.cards };
      for (const c of notInDeck) next[c.id] = newCard();
      return { ...p, cards: next };
    });

  const answer = (grade: Grade) => {
    if (!current) return;
    refreshNow();
    updateProgress((p) => ({ ...p, cards: { ...p.cards, [current.id]: review(p.cards[current.id], grade) } }));
    setRevealed(false);
  };

  const nextDue = deck
    .map((c) => progress.cards[c.id].due)
    .sort()
    .find((d) => new Date(d) > now);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Cards in your deck" value={deck.length} />
        <Stat label="Due now" value={due.length} testId="due-count" />
        <Stat label="Not added yet" value={notInDeck.length} />
      </div>

      {current ? (
        <div className="rounded-xl border border-line bg-surface-1 p-5" data-testid="review-card">
          <div className="text-xs text-muted">
            From{" "}
            <Link className="text-accent hover:underline" href={lessonHref(getLesson(current.lesson)!)}>
              {getLesson(current.lesson)?.title}
            </Link>
          </div>
          <p className="mt-3 text-lg font-medium leading-relaxed">{current.front}</p>
          {revealed ? (
            <>
              <div className="mt-4 rounded-lg bg-surface-2 p-4 leading-relaxed">{current.back}</div>
              <div className="mt-4 text-sm text-ink-2">How well did you recall it?</div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {grades.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => answer(g.grade)}
                    className="rounded-lg border border-line px-3 py-2 text-left hover:border-accent"
                  >
                    <div className="text-sm font-medium">{g.label}</div>
                    <div className="text-xs text-ink-2">
                      {g.hint} · next in {previewIntervals(progress.cards[current.id], now)[g.grade]}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Show answer
            </button>
          )}
          <p className="mt-4 text-xs text-muted">Say your answer out loud, or write it down, before revealing.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface-1 p-5 text-sm">
          {deck.length === 0 ? (
            <p>Your deck is empty. Add the cards from the lessons you&apos;ve opened, or all Keystone cards at once.</p>
          ) : (
            <p>
              <span className="font-medium text-good">Nothing due. </span>
              {nextDue
                ? `Next card is due ${new Date(nextDue).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" })}.`
                : ""}
            </p>
          )}
        </div>
      )}

      {notInDeck.length > 0 && (
        <button type="button" onClick={addAll} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-accent">
          Add all {notInDeck.length} cards from ready lessons
        </button>
      )}

      <section>
        <h2 className="text-sm font-medium">Cards by lesson</h2>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface-1 text-sm">
          {allLessons
            .filter((l) => cards.some((c) => c.lesson === l.slug))
            .map((l) => {
              const ls = cards.filter((c) => c.lesson === l.slug);
              const added = ls.filter((c) => progress.cards[c.id]).length;
              return (
                <li key={l.slug} className="flex items-center gap-3 px-4 py-2">
                  <Link href={lessonHref(l)} className="flex-1 hover:text-accent">
                    {l.title}
                  </Link>
                  <span className="text-xs text-ink-2 tabular">
                    {added}/{ls.length} in deck
                  </span>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

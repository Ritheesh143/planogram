"use client";

import { useState, type ReactNode } from "react";

type Props = {
  question: string;
  options: string[];
  answer: number;
  children: ReactNode; // explanation shown after a guess
};

/** Commit to a guess before the reveal. Wrong guesses are useful data, not failure. */
export function Predict({ question, options, answer, children }: Props) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <div className="text-xs font-semibold tracking-wide text-muted">PREDICT FIRST</div>
      <p className="mt-1 font-medium">{question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o, i) => {
          const chosen = pick === i;
          const correct = pick !== null && i === answer;
          return (
            <button
              key={o}
              type="button"
              disabled={pick !== null}
              onClick={() => setPick(i)}
              className={[
                "rounded-lg border px-3 py-1.5 text-sm",
                correct ? "border-good bg-good/10 text-ink" : "",
                chosen && !correct ? "border-critical text-ink" : "",
                pick === null ? "border-line hover:border-accent" : "border-line",
              ].join(" ")}
            >
              {correct && "✓ "}
              {chosen && !correct && "✗ "}
              {o}
            </button>
          );
        })}
      </div>
      {pick !== null && (
        <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm">
          <p className="font-medium">
            {pick === answer ? "Right." : `Not quite. The answer is ${options[answer]}.`}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

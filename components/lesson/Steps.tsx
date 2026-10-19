"use client";

import { Children, useState, type ReactNode } from "react";

/** Reveals worked steps one at a time so you can predict each before seeing it. */
export function Steps({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(1);
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <ol className="space-y-4">
        {items.slice(0, shown).map((child, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold tabular">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-3">{child}</div>
          </li>
        ))}
      </ol>
      <div className="no-print mt-4 flex items-center gap-3">
        {shown < items.length ? (
          <button
            type="button"
            onClick={() => setShown((s) => s + 1)}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Next step ({shown}/{items.length})
          </button>
        ) : (
          <span className="text-sm text-good">All {items.length} steps shown.</span>
        )}
        {shown > 1 && (
          <button type="button" onClick={() => setShown(1)} className="text-sm text-ink-2 hover:text-ink">
            Start over
          </button>
        )}
        {shown < items.length && (
          <button type="button" onClick={() => setShown(items.length)} className="text-sm text-ink-2 hover:text-ink">
            Show all
          </button>
        )}
      </div>
    </div>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

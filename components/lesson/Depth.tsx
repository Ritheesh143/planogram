"use client";

import type { ReactNode } from "react";
import { setDepth, useProgress } from "@/lib/progress";

const names = { 2: "L2 Derivation", 3: "L3 Rigor" } as const;

/** Content shown only at or above a depth level; otherwise a one-line pointer to it. */
export function Depth({ min, label, children }: { min: 2 | 3; label?: string; children: ReactNode }) {
  const { depth } = useProgress();
  if (depth >= min) {
    return (
      <div className="rounded-xl border-l-2 border-accent bg-accent-wash/40 py-1 pl-4">
        <div className="mb-1 text-[11px] font-semibold tracking-wide text-accent">{names[min].toUpperCase()}</div>
        <div className="space-y-4">{children}</div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setDepth(min)}
      className="no-print w-full rounded-lg border border-dashed border-axis px-4 py-2 text-left text-sm text-ink-2 hover:border-accent hover:text-ink"
    >
      {label ?? "There's more here"}: switch to {names[min]} to see it →
    </button>
  );
}

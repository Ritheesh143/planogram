"use client";

import Link from "next/link";
import { useState } from "react";
import type { Flashcard } from "@/content/cards";
import { updateProgress, useProgress } from "@/lib/progress";
import { newCard } from "@/lib/srs";

export function Recall({ cards }: { cards: Flashcard[] }) {
  const progress = useProgress();
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const inDeck = cards.filter((c) => progress.cards[c.id]).length;

  const addAll = () =>
    updateProgress((p) => {
      const next = { ...p.cards };
      for (const c of cards) if (!next[c.id]) next[c.id] = newCard();
      return { ...p, cards: next };
    });

  const flip = (id: string) =>
    setFlipped((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const open = flipped.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => flip(c.id)}
              aria-expanded={open}
              className="min-h-28 rounded-xl border border-line bg-surface-1 p-4 text-left text-sm hover:border-accent"
            >
              <div className="text-[11px] font-semibold tracking-wide text-muted">
                {open ? "ANSWER" : "QUESTION · tap to flip"}
              </div>
              <div className={open ? "mt-1" : "mt-1 font-medium"}>{open ? c.back : c.front}</div>
            </button>
          );
        })}
      </div>
      <div className="no-print flex flex-wrap items-center gap-3">
        {inDeck < cards.length ? (
          <button
            type="button"
            onClick={addAll}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Add {cards.length - inDeck} card{cards.length - inDeck === 1 ? "" : "s"} to my review deck
          </button>
        ) : (
          <span className="text-sm text-good">✓ All {cards.length} cards are in your review deck.</span>
        )}
        <Link href="/review" className="text-sm text-accent hover:underline">
          Open review →
        </Link>
      </div>
    </div>
  );
}

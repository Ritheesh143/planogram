"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@/lib/progress";
import { sectionsFor, type LessonKind } from "./sections";

type Block = { min: number; section: string };

/** Finds the page's <Depth> blocks (shown or collapsed) in document order. */
function readBlocks(): Block[] {
  return [...document.querySelectorAll<HTMLElement>(".lesson-body [data-depth-min]")].map((el) => ({
    min: Number(el.dataset.depthMin),
    section: el.closest("section[id]")?.id ?? "",
  }));
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** One line under the Depth toggle: what the current level adds, with a jump to the first block. */
export function DepthSummary({ kind }: { kind: LessonKind }) {
  const { depth } = useProgress();
  const [blocks, setBlocks] = useState<Block[] | null>(null);

  // The blocks render in the same commit as the toggle, so read them after each depth change.
  useEffect(() => {
    const read = () => setBlocks(readBlocks());
    read();
  }, [depth]);

  if (!blocks || blocks.length === 0) return null;
  const sectionTitle = (id: string) => sectionsFor(kind).find((s) => s.id === id)?.title ?? "this page";

  // At L1, point at what's hidden; at L2 and L3, at what this level reveals.
  const index = blocks.findIndex((b) => (depth === 1 ? b.min >= 2 : b.min <= depth));
  const shown = blocks.filter((b) => b.min <= depth).length;
  const deeper = blocks.length - shown;
  const first = blocks[index];

  const jump = () => {
    const el = document.querySelectorAll<HTMLElement>(".lesson-body [data-depth-min]")[index];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  let text: string;
  if (depth === 1) text = `L1 hides ${plural(blocks.length, "deeper block")}, the first in ${sectionTitle(first.section)}.`;
  else {
    text = `L${depth} adds ${plural(shown, "extra block")} to this page, the first in ${sectionTitle(first.section)}.`;
    if (deeper > 0) text += ` ${deeper} more at L3.`;
  }

  return (
    <p className="no-print mt-2 px-1 text-xs text-ink-2" data-testid="depth-summary">
      {text}{" "}
      <button type="button" onClick={jump} className="text-accent hover:underline">
        Jump to it →
      </button>
    </p>
  );
}

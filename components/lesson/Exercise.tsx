import type { ReactNode } from "react";

const tone = {
  easy: "text-good",
  medium: "text-accent",
  hard: "text-critical",
};

export function Exercise({
  n,
  level,
  title,
  children,
}: {
  n: number;
  level: "easy" | "medium" | "hard";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">Exercise {n}</span>
        <span className={`text-xs font-medium uppercase tracking-wide ${tone[level]}`}>{level}</span>
      </div>
      <div className="mt-1 font-medium">{title}</div>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  );
}

export function Solution({ children }: { children: ReactNode }) {
  return (
    <details className="group rounded-lg bg-surface-2 px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-medium text-accent">
        Show worked solution
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export function KeyIdea({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-accent-wash p-4">
      <div className="text-xs font-semibold tracking-wide text-accent">KEY IDEA</div>
      <div className="mt-1 space-y-2 font-medium">{children}</div>
    </div>
  );
}

export function Trap({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <div className="text-xs font-semibold tracking-wide text-critical">⚠ COMMON TRAP</div>
      <div className="mt-1 space-y-2">{children}</div>
    </div>
  );
}

export function QA({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-line bg-surface-1 px-4 py-3">
      <summary className="cursor-pointer select-none font-medium">{q}</summary>
      <div className="mt-3 space-y-3 text-[15px]">{children}</div>
    </details>
  );
}

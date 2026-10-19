"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Key } from "@/components/viz/kit";
import { lessonStatus, useProgress } from "@/lib/progress";

export type GraphLesson = {
  slug: string;
  title: string;
  aisle: string;
  href: string;
  ready: boolean;
  prereqs: string[];
  x: number;
  y: number;
};

type Props = {
  lessons: GraphLesson[];
  aisles: { id: string; name: string }[];
  width: number;
  height: number;
};

const NODE_W = 160;
const NODE_H = 24;
// Aisles take categorical slots in their fixed store order.
const aisleColor = (i: number) => `var(--series-${(i % 8) + 1})`;

function shorten(t: string, n = 24) {
  const base = t.split(":")[0];
  return base.length > n ? `${base.slice(0, n - 1)}…` : base;
}

export function ConceptGraph({ lessons, aisles, width, height }: Props) {
  const progress = useProgress();
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const bySlug = useMemo(() => new Map(lessons.map((l) => [l.slug, l])), [lessons]);
  const children = useMemo(() => {
    const m = new Map<string, string[]>(lessons.map((l) => [l.slug, []]));
    lessons.forEach((l) => l.prereqs.forEach((p) => m.get(p)?.push(l.slug)));
    return m;
  }, [lessons]);
  const related = useMemo(() => {
    if (!focus) return null;
    const up = new Set<string>();
    const down = new Set<string>();
    const walk = (id: string, next: (s: string) => string[], into: Set<string>) => {
      for (const n of next(id)) if (!into.has(n)) {
        into.add(n);
        walk(n, next, into);
      }
    };
    walk(focus, (s) => bySlug.get(s)!.prereqs, up);
    walk(focus, (s) => children.get(s)!, down);
    return { up, down };
  }, [focus, bySlug, children]);
  const color = (aisle: string) => aisleColor(aisles.findIndex((a) => a.id === aisle));
  const dim = (slug: string) => {
    const l = bySlug.get(slug)!;
    if (hidden.has(l.aisle)) return true;
    if (!related) return false;
    return slug !== focus && !related.up.has(slug) && !related.down.has(slug);
  };
  const focused = focus ? bySlug.get(focus) : null;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" aria-label="Show or hide aisles">
        {aisles.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={!hidden.has(a.id)}
            onClick={() =>
              setHidden((h) => {
                const n = new Set(h);
                if (n.has(a.id)) n.delete(a.id);
                else n.add(a.id);
                return n;
              })
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${hidden.has(a.id) ? "border-line text-muted" : "border-line text-ink"}`}
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: hidden.has(a.id) ? "var(--grid)" : color(a.id) }} />
            {a.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span>Solid border: ready to learn. Dashed: planned. Filled: mastered.</span>
        <span>Arrows run from a prerequisite to what it unlocks. Hover a lesson to light up its path.</span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface-1" data-testid="graph-scroll">
        <svg width={width} height={height} role="img" aria-label="Concept graph of all lessons and their prerequisites" className="block">
          <defs>
            <marker id="cg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0L10,5L0,10z" fill="var(--axis)" />
            </marker>
          </defs>
          {lessons.flatMap((l) =>
            l.prereqs.map((p) => {
              const a = bySlug.get(p)!;
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = l.x - 2;
              const y2 = l.y + NODE_H / 2;
              const mid = (x1 + x2) / 2;
              // On the focused lesson's path: upstream edges between its prerequisites, or downstream edges to what it unlocks.
              const onPath =
                !!related &&
                ((related.up.has(p) && (related.up.has(l.slug) || l.slug === focus)) || ((p === focus || related.down.has(p)) && related.down.has(l.slug)));
              const faded = dim(p) || dim(l.slug);
              return (
                <path
                  key={`${p}-${l.slug}`}
                  d={`M${x1},${y1}C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={onPath ? "var(--ink-2)" : "var(--axis)"}
                  strokeWidth={onPath ? 1.8 : 1}
                  strokeOpacity={faded && !onPath ? 0.15 : 0.8}
                  markerEnd="url(#cg-arrow)"
                />
              );
            }),
          )}
          {lessons.map((l) => {
            const status = lessonStatus(progress, l.slug);
            const mastered = l.ready && status === "mastered";
            const c = color(l.aisle);
            return (
              <Link key={l.slug} href={l.href} data-testid={`graph-node-${l.slug}`}>
                <g
                  transform={`translate(${l.x},${l.y})`}
                  opacity={dim(l.slug) ? 0.2 : 1}
                  onMouseEnter={() => setFocus(l.slug)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(l.slug)}
                  onBlur={() => setFocus(null)}
                >
                  <title>{l.title}</title>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    fill={mastered ? c : "var(--surface-1)"}
                    fillOpacity={mastered ? 0.25 : 1}
                    stroke={c}
                    strokeWidth={l.slug === focus ? 2.5 : 1.5}
                    strokeDasharray={l.ready ? undefined : "4 3"}
                  />
                  <text x={8} y={16} fontSize={11} fill={l.ready ? "var(--ink)" : "var(--muted)"}>
                    {mastered ? "✓ " : ""}
                    {shorten(l.title)}
                  </text>
                </g>
              </Link>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 min-h-12 rounded-lg bg-surface-2 p-3 text-sm" aria-live="polite">
        {focused ? (
          <>
            <span className="font-semibold">{focused.title}</span>{" "}
            <span className="text-ink-2">
              needs {related!.up.size} {related!.up.size === 1 ? "lesson" : "lessons"} before it and unlocks {related!.down.size} after it.
            </span>
          </>
        ) : (
          <span className="text-ink-2">Hover or tab to a lesson to see everything it depends on and everything it unlocks.</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {aisles.map((a, i) => (
          <Key key={a.id} color={aisleColor(i)} label={a.name} shape="bar" />
        ))}
      </div>
    </div>
  );
}

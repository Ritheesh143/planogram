"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Aisle, Lesson } from "@/lib/curriculum";
import { lessonStatus, useProgress, type LessonStatus } from "@/lib/progress";

type Props = {
  aisles: Aisle[];
  lessons: (Lesson & { href: string })[];
};

const W = 1000;
const BAY_W = 46;
const BAY_H = 20;
const GAP = 3;
const TOP = 70;

type Hover = { lesson: Lesson & { href: string }; x: number; y: number } | null;

function bayFill(status: LessonStatus, ready: boolean): string {
  if (!ready) return "var(--surface-2)";
  if (status === "mastered") return "var(--seq-550)";
  if (status === "started") return "var(--seq-250)";
  return "var(--surface-1)";
}

const statusLabel: Record<LessonStatus, string> = {
  new: "Not started",
  started: "In progress",
  mastered: "Mastered",
};

export function StoreMap({ aisles, lessons }: Props) {
  const router = useRouter();
  const progress = useProgress();
  const [hover, setHover] = useState<Hover>(null);

  const shelfAisles = aisles.filter((a) => a.id !== "checkout");
  const checkout = aisles.find((a) => a.id === "checkout");
  const colW = (W - 80) / shelfAisles.length;

  // The first ready lesson that isn't mastered is where the learner should go next.
  const next = useMemo(
    () =>
      lessons
        .filter((l) => l.status === "ready")
        .sort((a, b) => (a.week ?? 99) - (b.week ?? 99) || (a.keystone ?? 9) - (b.keystone ?? 9))
        .find((l) => lessonStatus(progress, l.slug) !== "mastered"),
    [lessons, progress],
  );

  const maxBays = Math.max(
    ...shelfAisles.map((a) => lessons.filter((l) => l.aisle === a.id).length),
  );
  const shelfBottom = TOP + 40 + Math.ceil(maxBays / 2) * (BAY_H + GAP) + 20;
  const H = shelfBottom + 170;

  const go = (href: string) => router.push(href);

  const bay = (l: Lesson & { href: string }, x: number, y: number) => {
    const ready = l.status === "ready";
    const status = lessonStatus(progress, l.slug);
    const isNext = next?.slug === l.slug;
    return (
      <a
        key={l.slug}
        href={l.href}
        aria-label={`${l.title} (${ready ? statusLabel[status] : "Planned"})`}
        onClick={(e) => {
          e.preventDefault();
          go(l.href);
        }}
        onMouseEnter={() => setHover({ lesson: l, x: x + BAY_W / 2, y })}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover({ lesson: l, x: x + BAY_W / 2, y })}
        onBlur={() => setHover(null)}
        className="cursor-pointer outline-none"
      >
        {/* Invisible hit area larger than the mark. */}
        <rect x={x - 1} y={y - 1} width={BAY_W + 2} height={BAY_H + 2} fill="transparent" />
        {isNext && (
          <rect
            x={x - 4}
            y={y - 4}
            width={BAY_W + 8}
            height={BAY_H + 8}
            rx={6}
            fill="none"
            stroke="var(--series-2)"
            strokeWidth={2}
          >
            <animate attributeName="opacity" values="1;0.35;1" dur="2s" repeatCount="indefinite" />
          </rect>
        )}
        <rect
          x={x}
          y={y}
          width={BAY_W}
          height={BAY_H}
          rx={3}
          fill={bayFill(status, ready)}
          stroke={ready ? "var(--accent)" : "var(--grid)"}
          strokeWidth={ready ? 1.5 : 1}
          opacity={ready ? 1 : 0.9}
        />
        {l.keystone && (
          <text
            x={x + BAY_W / 2}
            y={y + BAY_H / 2 + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={status === "mastered" ? "#fff" : "var(--ink)"}
          >
            K{l.keystone}
          </text>
        )}
      </a>
    );
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Store floor plan. Aisles are tracks and bays are lessons."
      >
        {/* Building */}
        <rect x={10} y={10} width={W - 20} height={H - 20} rx={18} fill="var(--surface-1)" stroke="var(--axis)" />
        <text x={40} y={45} fontSize={13} fill="var(--muted)" letterSpacing={2}>
          BOLT &amp; BEAM · LEARNING FLOOR
        </text>

        {shelfAisles.map((a, i) => {
          const x0 = 40 + i * colW;
          const inAisle = lessons.filter((l) => l.aisle === a.id);
          const left = x0 + (colW - (BAY_W * 2 + 18)) / 2;
          return (
            <g key={a.id}>
              <rect x={x0 + 4} y={TOP} width={colW - 8} height={30} rx={6} fill="var(--surface-2)" />
              <text x={x0 + colW / 2} y={TOP + 13} textAnchor="middle" fontSize={10} fill="var(--muted)" letterSpacing={1.5}>
                AISLE {a.number}
              </text>
              <text x={x0 + colW / 2} y={TOP + 25} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
                {a.name.length > 18 ? a.name.slice(0, 17) + "…" : a.name}
              </text>
              {/* Floor of the aisle between the two shelves */}
              <rect
                x={left + BAY_W + 4}
                y={TOP + 40}
                width={10}
                height={Math.ceil(inAisle.length / 2) * (BAY_H + GAP)}
                rx={3}
                fill="var(--page)"
              />
              {inAisle.map((l, j) => {
                const col = j % 2;
                const row = Math.floor(j / 2);
                const x = left + col * (BAY_W + 18);
                const y = TOP + 40 + row * (BAY_H + GAP);
                return bay(l, x, y);
              })}
            </g>
          );
        })}

        {/* Front of store */}
        <line x1={30} x2={W - 30} y1={shelfBottom} y2={shelfBottom} stroke="var(--grid)" />
        {checkout && (
          <g>
            <text x={40} y={shelfBottom + 28} fontSize={10} fill="var(--muted)" letterSpacing={1.5}>
              AISLE {checkout.number} · CHECKOUT LANES
            </text>
            {lessons
              .filter((l) => l.aisle === checkout.id)
              .map((l, j) => bay(l, 40 + j * (BAY_W + 12), shelfBottom + 40))}
          </g>
        )}

        <ServiceDesk x={W - 420} y={shelfBottom + 22} title="Customer Service" sub="Floor Check" onClick={() => go("/check")} href="/check" />
        <ServiceDesk x={W - 215} y={shelfBottom + 22} title="Returns Desk" sub="Spaced review" onClick={() => go("/review")} href="/review" />

        {/* Entrance */}
        <rect x={W / 2 - 70} y={H - 16} width={140} height={12} fill="var(--surface-1)" />
        <text x={W / 2} y={H - 26} textAnchor="middle" fontSize={11} fill="var(--muted)" letterSpacing={2}>
          ENTRANCE
        </text>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface-1 p-3 text-sm shadow-lg"
          style={{ left: `${(hover.x / W) * 100}%`, top: `calc(${(hover.y / H) * 100}% - 8px)` }}
        >
          <div className="font-medium leading-snug">{hover.lesson.title}</div>
          <div className="mt-1 text-xs text-ink-2">
            {hover.lesson.status === "ready"
              ? statusLabel[lessonStatus(progress, hover.lesson.slug)]
              : "Planned"}
            {hover.lesson.week ? ` · Sprint week ${hover.lesson.week}` : ""}
          </div>
        </div>
      )}

      <MapLegend />
      {next && (
        <p className="mt-3 text-sm text-ink-2">
          Next up:{" "}
          <Link className="font-medium text-accent underline-offset-2 hover:underline" href={next.href}>
            {next.title}
          </Link>
        </p>
      )}
    </div>
  );
}

function ServiceDesk({
  x,
  y,
  title,
  sub,
  href,
  onClick,
}: {
  x: number;
  y: number;
  title: string;
  sub: string;
  href: string;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="cursor-pointer"
    >
      <rect x={x} y={y} width={190} height={58} rx={10} fill="var(--accent-wash)" stroke="var(--accent)" />
      <text x={x + 14} y={y + 25} fontSize={13} fontWeight={600} fill="var(--ink)">
        {title}
      </text>
      <text x={x + 14} y={y + 43} fontSize={12} fill="var(--ink-2)">
        {sub} →
      </text>
    </a>
  );
}

function MapLegend() {
  const items: { label: string; fill: string; stroke: string }[] = [
    { label: "Planned", fill: "var(--surface-2)", stroke: "var(--grid)" },
    { label: "Ready", fill: "var(--surface-1)", stroke: "var(--accent)" },
    { label: "In progress", fill: "var(--seq-250)", stroke: "var(--accent)" },
    { label: "Mastered", fill: "var(--seq-550)", stroke: "var(--accent)" },
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <svg width="22" height="12" aria-hidden>
            <rect x="1" y="1" width="20" height="10" rx="2" fill={i.fill} stroke={i.stroke} />
          </svg>
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="font-semibold text-ink">K1–K4</span> Keystones: start here
      </li>
    </ul>
  );
}

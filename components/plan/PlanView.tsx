"use client";

import Link from "next/link";
import { useState } from "react";
import { marathon, sprintFocus, sprintTasks } from "@/content/plan";
import { lessonStatus, logHours, removeHours, setSprintStart, togglePlanItem, useProgress } from "@/lib/progress";
import { useNow } from "@/lib/useNow";

type WeekLesson = { slug: string; title: string; href: string; ready: boolean; week: number };

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const parseDay = (s: string) => Date.parse(`${s}T00:00:00Z`);
const TARGET = [12, 15];

export function PlanView({ lessons }: { lessons: WeekLesson[] }) {
  const progress = useProgress();
  const now = useNow();
  const { plan } = progress;
  const today = now ? isoDay(now) : "";
  const start = plan.start;
  const weekOf = (date: string) => (start ? Math.floor((parseDay(date) - parseDay(start)) / (7 * DAY)) + 1 : null);
  const currentWeek = start && today ? weekOf(today) : null;
  const hoursByWeek = new Map<number, number>();
  for (const h of plan.hours) {
    const w = weekOf(h.date);
    if (w !== null) hoursByWeek.set(w, (hoursByWeek.get(w) ?? 0) + h.hours);
  }
  const totalHours = plan.hours.reduce((s, h) => s + h.hours, 0);
  const sprintLessons = lessons.filter((l) => l.ready);
  const masteredCount = sprintLessons.filter((l) => lessonStatus(progress, l.slug) === "mastered").length;
  const lastCheck = progress.checks.at(-1);
  const [open, setOpen] = useState<number | null>(null);
  const shownOpen = open ?? (currentWeek && currentWeek >= 1 && currentWeek <= 16 ? currentWeek : 1);

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Sprint week" value={currentWeek ? (currentWeek > 16 ? "Done" : `${Math.max(currentWeek, 1)} of 16`) : "Not started"} testid="plan-week" />
        <Stat label="Ready lessons mastered" value={`${masteredCount} of ${sprintLessons.length}`} />
        <Stat label="Hours logged" value={totalHours ? `${totalHours}` : "0"} testid="plan-hours" />
        <Stat label="Last Floor Check" value={lastCheck ? `${lastCheck.score} of ${lastCheck.total}` : "Not taken"} />
      </section>

      <section className="rounded-xl border border-line bg-surface-1 p-4">
        <h2 className="font-semibold">Start date</h2>
        <p className="mt-1 text-sm text-ink-2">Pick the Monday you started (or will start) week 1. Weeks, hours and the current-week marker follow from it.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Sprint start date"
            data-testid="plan-start"
            value={start ?? ""}
            onChange={(e) => e.target.value && setSprintStart(e.target.value)}
            className="rounded-lg border border-line bg-surface-1 px-2 py-1 text-sm"
          />
          {!start && today && (
            <button type="button" onClick={() => setSprintStart(today)} className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white">
              Start today
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">The 16-week sprint</h2>
        <p className="mt-1 text-sm text-ink-2">
          About {TARGET[0]}–{TARGET[1]} hours a week. Lessons are checked off when you mark them mastered; tick career tasks yourself.
        </p>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => {
            const wl = lessons.filter((l) => l.week === w);
            const tasks = sprintTasks.filter((t) => t.week === w);
            const done = wl.filter((l) => lessonStatus(progress, l.slug) === "mastered").length + tasks.filter((t) => plan.done.includes(t.id)).length;
            const total = wl.length + tasks.length;
            const hrs = hoursByWeek.get(w) ?? 0;
            const isOpen = shownOpen === w;
            return (
              <div key={w} className={`rounded-xl border bg-surface-1 ${currentWeek === w ? "border-accent" : "border-line"}`} data-testid={`plan-week-${w}`}>
                <button type="button" onClick={() => setOpen(isOpen ? 0 : w)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="w-16 shrink-0 text-sm font-semibold tabular">Week {w}</span>
                  <span className="flex-1 text-sm text-ink-2">{sprintFocus[w]}</span>
                  <span className="hidden shrink-0 text-xs text-muted tabular sm:inline">
                    {total ? `${done}/${total} done` : "review week"}
                    {start ? ` · ${hrs} h` : ""}
                  </span>
                  {currentWeek === w && <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[11px] text-white">This week</span>}
                </button>
                {isOpen && (
                  <div className="grid gap-4 border-t border-line px-4 py-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium tracking-widest text-muted">LESSONS</div>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {wl.length === 0 && <li className="text-ink-2">Practice and review week.</li>}
                        {wl.map((l) => {
                          const st = lessonStatus(progress, l.slug);
                          return (
                            <li key={l.slug} className="flex items-start gap-2">
                              <span aria-hidden className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${st === "mastered" ? "border-accent bg-accent" : "border-axis"}`} />
                              <Link href={l.href} className={l.ready ? "hover:text-accent" : "text-ink-2 hover:text-ink"}>
                                {l.title}
                              </Link>
                              {!l.ready && <span className="text-xs text-muted">planned</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-medium tracking-widest text-muted">CAREER AND PRACTICE</div>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {tasks.length === 0 && <li className="text-ink-2">Nothing extra: keep the daily DSA and review habit.</li>}
                        {tasks.map((t) => (
                          <li key={t.id}>
                            <label className="flex items-start gap-2">
                              <input type="checkbox" className="mt-1" checked={plan.done.includes(t.id)} onChange={() => togglePlanItem(t.id)} data-testid={`plan-task-${t.id}`} />
                              <span>{t.text}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <HoursLog today={today} weekOf={weekOf} />

      <section>
        <h2 className="text-xl font-semibold tracking-tight">The 24-month marathon</h2>
        <p className="mt-1 text-sm text-ink-2">Milestones, not deadlines: tick them when they&apos;re true.</p>
        <ol className="mt-3 space-y-2">
          {marathon.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-surface-1 px-4 py-2.5">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1" checked={plan.done.includes(m.id)} onChange={() => togglePlanItem(m.id)} />
                <span className="w-20 shrink-0 font-semibold tabular">Month {m.month}</span>
                <span>{m.text}</span>
              </label>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular" data-testid={testid}>
        {value}
      </div>
    </div>
  );
}

function HoursLog({ today, weekOf }: { today: string; weekOf: (d: string) => number | null }) {
  const { plan } = useProgress();
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("1");
  const [note, setNote] = useState("");
  const d = date || today;
  const h = Number(hours);
  const recent = plan.hours.map((e, i) => ({ ...e, i })).slice(-8).reverse();
  return (
    <section className="rounded-xl border border-line bg-surface-1 p-4">
      <h2 className="font-semibold">Hours log</h2>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!d || !(h > 0)) return;
          logHours({ date: d, hours: h, note: note.trim() });
          setNote("");
        }}
      >
        <label className="text-xs text-ink-2">
          Date
          <input type="date" value={d} onChange={(e) => setDate(e.target.value)} className="mt-0.5 block rounded-lg border border-line bg-surface-1 px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-ink-2">
          Hours
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            data-testid="plan-hours-input"
            className="mt-0.5 block w-20 rounded-lg border border-line bg-surface-1 px-2 py-1 text-sm"
          />
        </label>
        <label className="min-w-40 flex-1 text-xs text-ink-2">
          What you did
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gamma–Poisson exercises 1–4" className="mt-0.5 block w-full rounded-lg border border-line bg-surface-1 px-2 py-1 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white">
          Log hours
        </button>
      </form>
      {recent.length > 0 && (
        <table className="mt-3 w-full text-sm tabular">
          <tbody>
            {recent.map((e) => {
              const w = weekOf(e.date);
              return (
                <tr key={e.i}>
                  <td className="border-t border-line py-1 pr-2">{e.date}</td>
                  <td className="border-t border-line py-1 pr-2 text-muted">{w ? `week ${w}` : ""}</td>
                  <td className="border-t border-line py-1 pr-2">{e.hours} h</td>
                  <td className="border-t border-line py-1 pr-2 text-ink-2">{e.note}</td>
                  <td className="border-t border-line py-1 text-right">
                    <button type="button" onClick={() => removeHours(e.i)} className="text-xs text-muted hover:text-ink" aria-label={`Remove ${e.hours} hours on ${e.date}`}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

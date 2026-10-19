import Link from "next/link";
import { getLesson, lessonHref } from "@/lib/curriculum";

type Item = { label: string; slug?: string; note: string };

/** A model's family tree: what it grew from, and what grows from it. Links go to lessons where they exist. */
export function Lineage({ from, self, to }: { from: Item[]; self: string; to: Item[] }) {
  const card = (it: Item, key: string) => {
    const l = it.slug ? getLesson(it.slug) : undefined;
    const body = (
      <>
        <div className="font-medium">
          {it.label}
          {l && l.status !== "ready" && <span className="ml-1.5 text-xs font-normal text-muted">(planned)</span>}
        </div>
        <div className="mt-0.5 text-xs text-ink-2">{it.note}</div>
      </>
    );
    return l ? (
      <Link key={key} href={lessonHref(l)} className="block rounded-lg border border-line bg-surface-1 p-3 hover:border-accent">
        {body}
      </Link>
    ) : (
      <div key={key} className="rounded-lg border border-line bg-surface-1 p-3">
        {body}
      </div>
    );
  };
  return (
    <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_auto_auto_1fr]">
      <div className="space-y-2">
        <div className="text-xs font-medium tracking-widest text-muted">CAME FROM</div>
        {from.map((it, i) => card(it, `f${i}`))}
      </div>
      <div aria-hidden className="hidden text-2xl text-muted md:block">→</div>
      <div className="rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white">{self}</div>
      <div aria-hidden className="hidden text-2xl text-muted md:block">→</div>
      <div className="space-y-2">
        <div className="text-xs font-medium tracking-widest text-muted">LEADS TO</div>
        {to.map((it, i) => card(it, `t${i}`))}
      </div>
    </div>
  );
}

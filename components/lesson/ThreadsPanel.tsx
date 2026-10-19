import Link from "next/link";

type Item = { title: string; href: string; ready: boolean };

type Props = {
  threads: { name: string; idea: string; steps: (Item & { current: boolean })[] }[];
  unlocks: Item[];
};

export function ThreadsPanel({ threads, unlocks }: Props) {
  return (
    <div className="space-y-4">
      {threads.map((t) => (
        <div key={t.name} className="rounded-xl border border-line bg-surface-1 p-4">
          <div className="text-xs font-semibold tracking-wide text-muted">GOLDEN THREAD</div>
          <div className="font-medium">{t.name}</div>
          <p className="text-sm text-ink-2">{t.idea}</p>
          <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {t.steps.map((s, i) => (
              <li key={s.href} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted" aria-hidden>→</span>}
                {s.current ? (
                  <span className="rounded-md bg-accent px-2 py-0.5 text-white">{s.title}</span>
                ) : (
                  <Link
                    href={s.href}
                    className={`rounded-md border border-line px-2 py-0.5 hover:border-accent ${s.ready ? "" : "text-ink-2"}`}
                  >
                    {s.title}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {unlocks.length > 0 && (
        <div className="text-sm">
          <span className="font-medium">This lesson unlocks: </span>
          {unlocks.map((u, i) => (
            <span key={u.href}>
              {i > 0 && " · "}
              <Link href={u.href} className="text-accent hover:underline">
                {u.title}
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { AisleList } from "@/components/map/AisleList";
import { StoreMap } from "@/components/map/StoreMap";
import { allAisles, allLessons, keystones, lessonHref } from "@/lib/curriculum";

export default function Home() {
  const lessons = allLessons.map((l) => ({ ...l, href: lessonHref(l) }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="max-w-3xl">
        <p className="text-xs font-medium tracking-widest text-muted">PLANOGRAM</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          The math behind the store, one aisle at a time.
        </h1>
        <p className="mt-3 text-ink-2">
          Every idea starts on the shop floor of Bolt &amp; Beam, a fictional home-improvement
          chain. You work it by hand with real numbers, see it, simulate it, and only then write
          the formula. Probability through Bayesian models, the Model Lab, your signature retail
          projects, then deep learning, agents and ML engineering.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Start here: the four Keystones</h2>
        <p className="mt-1 text-sm text-ink-2">
          These four ideas unlock most of the store. They are also among the most common
          screening questions in senior data science interviews.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {keystones.map((k) => (
            <li key={k.slug}>
              <Link
                href={lessonHref(k)}
                className="block h-full rounded-xl border border-line bg-surface-1 p-4 hover:border-accent"
              >
                <div className="text-xs font-semibold text-accent">KEYSTONE {k.keystone}</div>
                <div className="mt-1 font-medium leading-snug">{k.title}</div>
                <p className="mt-2 text-sm text-ink-2">{k.summary}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">The store map</h2>
        <p className="mt-1 text-sm text-ink-2">
          Aisles are tracks and each bay is a lesson. Bays fill in as you master them.
        </p>
        <div className="mt-4 hidden rounded-2xl border border-line bg-surface-1 p-3 sm:block">
          <StoreMap aisles={allAisles} lessons={lessons} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Every aisle, as a list</h2>
        <div className="mt-4">
          <AisleList aisles={allAisles} lessons={lessons} />
        </div>
      </section>
    </div>
  );
}

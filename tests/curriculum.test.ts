import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cards } from "@/content/cards";
import { checkQuestions, misconceptions } from "@/content/checks";
import { lessonBodies } from "@/content/registry";
import { authoredSections } from "@/components/lesson/sections";
import { allLessons, getLesson, validateCurriculum } from "@/lib/curriculum";

describe("curriculum", () => {
  it("has no duplicate slugs, dangling prerequisites or cycles", () => {
    expect(validateCurriculum()).toEqual([]);
  });

  it("detects a prerequisite cycle", () => {
    const a = { ...allLessons[0], slug: "a", prereqs: ["b"] };
    const b = { ...allLessons[0], slug: "b", prereqs: ["a"] };
    expect(validateCurriculum([a, b]).some((p) => p.startsWith("cycle"))).toBe(true);
  });

  it("gives every ready lesson an MDX body, and every body a ready lesson", () => {
    const ready = allLessons.filter((l) => l.status === "ready").map((l) => l.slug).sort();
    expect(Object.keys(lessonBodies).sort()).toEqual(ready);
  });

  it.each(allLessons.filter((l) => l.status === "ready").map((l) => [l.slug, l.aisle] as const))(
    "%s contains every template section once, in order",
    (slug, aisle) => {
      const kind = getLesson(slug)!.kind;
      const dir = kind === "model" ? "models" : `lessons/${aisle}`;
      const mdx = readFileSync(`content/${dir}/${slug}.mdx`, "utf8");
      const found = [...mdx.matchAll(/<Section id="([a-z]+)">/g)].map((m) => m[1]);
      expect(found).toEqual(authoredSections(kind));
    },
  );

  it("gives every ready lesson at least four flashcards", () => {
    for (const l of allLessons.filter((x) => x.status === "ready")) {
      expect(cards.filter((c) => c.lesson === l.slug).length).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps flashcard ids unique and attached to real lessons", () => {
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of cards) expect(getLesson(c.lesson)).toBeDefined();
  });

  it("points every Floor Check question and misconception at a real lesson", () => {
    for (const q of checkQuestions) {
      expect(getLesson(q.lesson)).toBeDefined();
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
      for (const o of q.options) {
        if (!o.correct) expect(misconceptions.some((m) => m.id === o.misconception)).toBe(true);
      }
    }
    for (const m of misconceptions) expect(getLesson(m.lesson)).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import { cardsForLesson } from "@/content/cards";
import { buildAskPrompt, CLAUDE_NEW_URL, MAX_KEY_IDEAS } from "@/lib/askClaude";
import { allLessons, getLesson } from "@/lib/curriculum";
import { lessonBodies } from "@/content/registry";

const lesson = getLesson("counting-worlds")!;
const base = {
  title: lesson.title,
  summary: lesson.summary,
  keyIdeas: cardsForLesson("counting-worlds"),
  section: "Do It by Hand",
  question: "Why is it only 15%?",
  url: "https://example.test/learn/foundations/counting-worlds",
};

describe("Ask Claude prompt builder", () => {
  const prompt = buildAskPrompt(base);

  it("opens claude.ai's new-chat page", () => {
    expect(CLAUDE_NEW_URL).toBe("https://claude.ai/new");
  });

  it("includes the title, summary, section, page and question", () => {
    expect(prompt).toContain(`"${lesson.title}"`);
    expect(prompt).toContain(`Lesson summary: ${lesson.summary}`);
    expect(prompt).toContain("I'm in the section: Do It by Hand");
    expect(prompt).toContain("Lesson page: https://example.test/learn/foundations/counting-worlds");
    expect(prompt).toContain("My question: Why is it only 15%?");
  });

  it("uses the lesson's flashcards as key ideas, capped", () => {
    const ideas = prompt.split("\n").filter((l) => l.startsWith("- "));
    expect(ideas).toHaveLength(Math.min(MAX_KEY_IDEAS, base.keyIdeas.length));
    expect(ideas[0]).toBe(`- ${base.keyIdeas[0].front} → ${base.keyIdeas[0].back}`);
    const many = Array.from({ length: 10 }, (_, i) => ({ front: `q${i}`, back: `a${i}` }));
    expect(buildAskPrompt({ ...base, keyIdeas: many }).split("\n").filter((l) => l.startsWith("- "))).toHaveLength(MAX_KEY_IDEAS);
  });

  it("asks for the house order, formula last", () => {
    const order = ["worked example", "picture", "simulation", "formula last"].map((w) => prompt.indexOf(w));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("leaves a placeholder for an empty question and drops missing optional parts", () => {
    const bare = buildAskPrompt({ title: "T", summary: "S", keyIdeas: [], question: "   " });
    expect(bare).toContain("My question: (Write your question here.)");
    expect(bare).not.toContain("Key ideas");
    expect(bare).not.toContain("I'm in the section");
    expect(bare).not.toContain("Lesson page");
  });

  it("every ready page has key ideas to send", () => {
    for (const l of allLessons.filter((x) => x.status === "ready" && lessonBodies[x.slug])) {
      expect(cardsForLesson(l.slug).length, l.slug).toBeGreaterThan(0);
    }
  });
});

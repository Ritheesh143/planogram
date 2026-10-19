import { describe, expect, it } from "vitest";
import { checkQuestions } from "@/content/checks";
import { scoreCheck } from "@/lib/check";

const pick = (pred: (o: { correct?: boolean; misconception?: string }) => boolean) =>
  Object.fromEntries(checkQuestions.map((q) => [q.id, (q.options.find(pred) ?? q.options[0]).id]));

describe("Floor Check scoring", () => {
  it("scores a perfect attempt with no findings", () => {
    const r = scoreCheck(pick((o) => !!o.correct));
    expect(r).toEqual({ score: checkQuestions.length, total: checkQuestions.length, findings: [] });
  });

  it("routes 'not sure' answers to each question's own lesson", () => {
    const r = scoreCheck(pick((o) => o.misconception === "unsure"));
    expect(r.score).toBe(0);
    const lessons = r.findings.filter((f) => f.misconception === "unsure").map((f) => f.lesson);
    expect(new Set(lessons)).toEqual(new Set(checkQuestions.map((q) => q.lesson)));
  });

  it("reports the flipped-conditional misconception from the 90% answer", () => {
    const r = scoreCheck({ "fraud-base-rate": "a" });
    expect(r.findings).toEqual([{ misconception: "inverse-conditional", lesson: "counting-worlds" }]);
  });
});

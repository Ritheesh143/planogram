import { checkQuestions, misconceptions } from "@/content/checks";

export type Finding = { misconception: string; lesson: string };
export type CheckResult = { score: number; total: number; findings: Finding[] };

/**
 * Score a Floor Check and collect the distinct misconceptions behind wrong answers, in
 * question order. A "not sure" points back to the lesson the question itself tests.
 */
export function scoreCheck(answers: Record<string, string>): CheckResult {
  let score = 0;
  const findings: Finding[] = [];
  for (const q of checkQuestions) {
    const pick = q.options.find((o) => o.id === answers[q.id]);
    if (!pick) continue;
    if (pick.correct) {
      score++;
      continue;
    }
    if (!pick.misconception) continue;
    const m = misconceptions.find((x) => x.id === pick.misconception);
    const lesson = pick.misconception === "unsure" || !m ? q.lesson : m.lesson;
    if (!findings.some((f) => f.misconception === pick.misconception && f.lesson === lesson)) {
      findings.push({ misconception: pick.misconception, lesson });
    }
  }
  return { score, total: checkQuestions.length, findings };
}

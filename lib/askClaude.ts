// "Ask Claude": builds a self-contained prompt from a lesson so the learner can paste it into
// claude.ai. No network calls and no API key: the site only copies text and opens a tab.

export const CLAUDE_NEW_URL = "https://claude.ai/new";

/** At most this many flashcards go into the prompt, so it stays short enough to paste. */
export const MAX_KEY_IDEAS = 6;

export type AskInput = {
  title: string;
  summary: string;
  /** The lesson's flashcards (content/cards.ts), used as its key ideas. */
  keyIdeas: { front: string; back: string }[];
  /** Title of the section the learner is reading, if any. */
  section?: string;
  question: string;
  /** Absolute page URL, so Claude's answer can point back to it. */
  url?: string;
};

export function buildAskPrompt(input: AskInput): string {
  const ideas = input.keyIdeas.slice(0, MAX_KEY_IDEAS);
  const question = input.question.trim() || "(Write your question here.)";
  const lines = [
    `I'm studying "${input.title}" on Planogram, a visual learning site for retail data science set in a fictional hardware retailer, Bolt & Beam.`,
    "",
    `Lesson summary: ${input.summary}`,
  ];
  if (input.url) lines.push(`Lesson page: ${input.url}`);
  if (input.section) lines.push(`I'm in the section: ${input.section}`);
  if (ideas.length > 0) {
    lines.push("", "Key ideas from the lesson:");
    for (const c of ideas) lines.push(`- ${c.front} → ${c.back}`);
  }
  lines.push(
    "",
    `My question: ${question}`,
    "",
    "Please explain in this order: a small worked example with concrete numbers first, then what a picture of it would show, then a quick simulation I could run in Python, and the formula last. I'm comfortable with Σ, algebra and derivatives. Keep it consistent with the key ideas above, and end with one question I can answer to check I understood.",
  );
  return lines.join("\n");
}

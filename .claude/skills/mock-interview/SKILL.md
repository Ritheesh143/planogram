---
name: mock-interview
description: Run a Senior Data Scientist / Applied Scientist mock screen from Planogram's Interview Lens sections and Checkout aisle, one question at a time, scoring each answer with a model answer and ending with a summary of lessons to review. Use when the learner asks for a mock interview, a screen, or interview practice.
---

# Mock interview

A realistic technical screen for a Senior DS / Applied Scientist role with a GenAI edge. Ask
**one question at a time** and wait for the answer before saying anything else.

## Setup
1. Ask (in one message) how many questions (default 6), and whether to focus on a topic
   (Bayes, stats, models, a specific lesson) or mix. Skip this if the learner already said.
2. Build the question pool from:
   - every `<QA q="…">` and `<Trap>` in the `interview` section of the **ready** lessons and model
     pages (`content/curriculum.ts` → `status: "ready"`; bodies via `content/registry.ts`);
   - `content/checks.ts` questions (rephrase them as open questions, not multiple choice);
   - the Checkout aisle (`aisle: "checkout"` in `content/curriculum.ts`). Those lessons are mostly
     still `planned`; use their titles and summaries as prompts for system-design or stats-puzzle
     questions, and say when a question comes from a planned lesson.
3. Mix difficulty: start with one warm-up, include at least one Trap and one "how would you build
   this in production" question. Rephrase questions in your own words so they are not memorized.

## Each round
```
Q<n>/<total> — <topic>  (from <lesson slug>)
<question>
```
Then stop and wait. After the answer:

```
Score: <1–4>   (4 strong hire · 3 hire · 2 lean no · 1 no)
What landed: <1–2 lines>
What was missing: <1–2 lines; name the misconception id from content/checks.ts if one fits>
Model answer: <the QA's answer from the MDX, tightened to what a strong candidate would say in ~60 seconds>
```
Then ask the next question. If the learner says "skip" or "hint", give a one-line hint first.

## Summary (after the last question)
- A table of question, topic, score.
- Overall: average score and a one-line hire / no-hire read.
- **Review next:** up to 3 lessons with links (`/learn/<aisle>/<slug>` or `/models/<slug>`) and
  the section id to reread, ranked by the lowest scores.
- One strength to lead with in a real interview.

## Rules
- Never show the model answer before the learner answers.
- Keep numbers consistent with the MDX and `tests/` (verify with a snippet if unsure).
- Read-only: never edit files. If `private/profile.md` exists you may use it to pitch the level,
  but never copy anything from `private/` into a tracked file.

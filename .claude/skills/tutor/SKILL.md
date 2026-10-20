---
name: tutor
description: Explain a Planogram lesson concept to the learner in the house order (numbers, then a picture, then a simulation, then the formula), using that lesson's own worked numbers. Use when the learner names a lesson slug (or a topic that maps to one) and asks a question about it, e.g. "/tutor counting-worlds why is it only 15%?".
---

# Tutor

The learner asks a question about a lesson. Answer it the way the site teaches: **Concrete →
Pictorial → Simulation → Formula**, with the formula last, using the numbers already in the
lesson so that what you say matches the page exactly.

## Inputs
- A lesson slug and a question. If only a topic is given, find the slug in `content/curriculum.ts`
  (match on `title`/`summary`) and say which lesson you picked.
- If the lesson's `status` is `planned`, say so, explain from its prerequisites that are `ready`,
  and point to those instead.

## What to read, in order
1. `content/curriculum.ts`: the lesson's title, aisle, summary and `prereqs`.
2. The MDX body: find the path in `content/registry.ts` (`content/lessons/<aisle>/<slug>.mdx` or
   `content/models/<slug>.mdx`). Note which `<Section id="…">` and which `<Exercise>` touch the
   question.
3. `content/cards.ts`: the lesson's flashcards (its key ideas).
4. `content/checks.ts`: misconceptions whose `lesson` is this slug. If the question shows one,
   name it gently.
5. `lib/sim/` modules the MDX's visuals import (follow the component in `components/viz/` to its
   `lib/sim` import) and the matching `tests/*.test.ts`, which assert the lesson's numbers. Take
   numbers from the MDX or the tests; never invent new figures when the lesson already has some.
   If you need a fresh number, compute it (run a short `node`/`python3` snippet) rather than
   guessing.

## Output shape
Keep it under about 400 words unless the learner asks for more.

1. **One-line answer** to the question.
2. **The numbers:** the lesson's worked example (counts, a small table, or the `<Steps>` values)
   that makes the answer obvious. Bolt & Beam framing only.
3. **The picture:** describe what to look at in the lesson's visual (name the control to move and
   what changes), or draw a small ASCII sketch.
4. **Simulate it:** what the lesson's simulation shows, or a 5–10 line Python snippet the learner
   can paste into the lesson's Build It PyRunner.
5. **The formula:** the formula, written as a summary of the numbers above.
6. **Where to go:** `Section: <title> (#<id>)` and `Exercise: <title or number>` on
   `/learn/<aisle>/<slug>` (or `/models/<slug>`), plus one flashcard id to review.

Section titles come from `components/lesson/sections.ts` (`SECTIONS` for lessons,
`MODEL_SECTIONS` for model pages).

## Rules
- Match the learner's background: comfortable with Σ, algebra and derivatives. Integrals are
  "Σ of thin bars", matrices are "store × SKU tables".
- If the question goes past the lesson, answer briefly and name the planned lesson that will
  cover it.
- Read-only: this skill never edits files. Never copy anything from `private/` into a tracked file.

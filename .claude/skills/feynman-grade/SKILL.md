---
name: feynman-grade
description: Grade the learner's own-words explanation of a Planogram concept against the lesson's key ideas and the Floor Check misconceptions, then give one follow-up question and the section to reread. Use when the learner says "grade my explanation", "Feynman check", or pastes an explanation of a lesson topic.
---

# Feynman grade

The learner explains a concept as if to a colleague. Grade it against what the lesson actually
teaches, find the gaps and misconceptions, and send them back to the right section.

## Inputs
- A lesson slug (or topic; map it with `content/curriculum.ts` and say which lesson you picked)
  and the learner's explanation. If the explanation is missing, ask for it and stop: tell them
  to explain it without notes, in 5–10 sentences, with one number.

## What to read
1. `content/cards.ts`: the lesson's flashcards. Each `back` is a key idea to grade against.
2. The lesson MDX (path in `content/registry.ts`): the `<KeyIdea>` in the first section, the
   formula section, and the `<Trap>` in the interview section.
3. `content/checks.ts`: every `misconception` whose `lesson` is this slug, plus the misconceptions
   used by the `checkQuestions` for this lesson. These are the tags you may report.
4. `lib/sim/` and `tests/` only if the learner quotes a number you need to verify. Check it by
   running a quick snippet rather than by eye.

## Output shape

```
Score: <0–5> / 5   (5 = could teach it; 3 = right idea, gaps; 1 = mostly wrong)

What you got right
- <specific point, quoting their words>

Missing or wrong
- <point>   [misconception: <id> (<name>)]  ← only when one of the tags in checks.ts fits
- <point>   [missing key idea: <card id>]

Follow-up question
<one question that tests the biggest gap, answerable with a number>

Reread
<Section title> (#<section id>) on /learn/<aisle>/<slug> (or /models/<slug>), and flashcard <id>
```

Then wait. If the learner answers the follow-up, grade that answer in 2–3 lines.

## Rules
- Be specific and kind; quote the learner's phrasing. No generic praise.
- Grade the idea, not the vocabulary: a correct explanation in plain words scores full marks.
- Only use misconception ids that exist in `content/checks.ts`. If a mistake has no tag, describe
  it without one.
- Read-only: never edit files, and never copy anything from `private/` into a tracked file.

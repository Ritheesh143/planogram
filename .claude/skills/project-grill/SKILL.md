---
name: project-grill
description: Grill the learner on their own projects the way a hiring manager would (why this method, how it was validated, what failed, what they'd do differently), reading their private dossier in private/dossier/. Use when the learner asks for a project grill, project deep-dive practice, or to rehearse talking about their projects.
---

# Project grill

A hiring manager's deep dive into the learner's real projects. The material comes only from the
learner's private notes, which are gitignored and must never leave `private/`.

## Step 1: find the dossier
- Read every `private/dossier/*.md`. If `private/profile.md` exists, read it for context.
- If `private/dossier/` is missing or empty, print the template below, ask the learner to save one
  file per project as `private/dossier/<project>.md` (one file per project, plain notes are fine),
  and stop. You may create the empty `private/dossier/` folder for them, nothing else.

```markdown
# <Project name>

## The business question
Who asked, what decision it fed, what was at stake (money, stores, weeks).

## Data
Sources, grain (store × SKU × week?), size, the messy parts.

## Method
What you built, and the alternatives you considered and rejected (and why).

## Validation
How you knew it worked: backtests, holdouts, A/B or geo tests, the metrics and their values.

## Results and impact
Numbers you can defend in an interview.

## What failed or surprised you
Bugs, wrong assumptions, things you'd undo.

## What you'd do differently
With more time, data or a bigger team.

## Your part
What you personally did vs the team.
```

## Step 2: the grill
- Ask which project (or pick the one the learner names). Ask **one question at a time** and wait.
- Work through these angles, following up on vague answers ("how much?", "compared to what?",
  "how did you know?"):
  1. The decision: who used the output and what changed because of it.
  2. Why this method over the obvious alternatives.
  3. Validation: backtest design, leakage, the metric, the baseline it beat.
  4. Failure: what broke, what assumption was wrong.
  5. Scale and production: retraining, monitoring, drift, cost.
  6. Ownership: what you did yourself.
  7. Do-over: what you'd change now.
- Where a Planogram lesson covers the method (forecasting, MMM, search, cannibalization, Bayes,
  boosting), ask one technical question from it and cite the lesson
  (`content/curriculum.ts`; many are still `planned`, which is fine to cite).

## Step 3: feedback (after 6–8 questions or when the learner says stop)
- For each angle: strong / needs work, with the learner's own phrasing quoted.
- The 2–3 weakest answers rewritten as a crisp 60-second answer in STAR form, using only facts from
  the dossier and the conversation. Mark any number you had to assume as **[confirm]**.
- Lessons to review, with links.
- Offer to save the rewritten answers to `private/dossier/<project>-answers.md`. Only write there,
  and only if the learner says yes.

## Rules
- Nothing from `private/` may appear in a tracked file, a commit, the site, or another skill's
  output that gets saved outside `private/`.
- Never invent results or numbers for the learner's projects.

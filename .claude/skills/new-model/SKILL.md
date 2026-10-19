---
name: new-model
description: Write or rewrite a Planogram Model Lab page (a curriculum entry with kind "model") in the house template, including its Failure Lab and lineage. Use whenever adding a model page such as gradient boosting, XGBoost vs LightGBM vs CatBoost, the MLP or the Model Arena.
---

# Writing a Model Lab page

Model pages teach one model end to end: where it came from, how it works by hand, the math,
what every knob does, **where it breaks on real data compared with other models**, and where it
leads. Everything in `.claude/skills/new-lesson/SKILL.md` still applies (Bolt & Beam only, numbers
by hand first, MDX gotchas, flashcards, verification). This file covers what is different.

## Checklist

1. **Curriculum entry** in `content/curriculum.ts` with `kind: "model"`, `aisle: "models"`,
   `status: "ready"` and `minutes`. The page renders at `/models/<slug>`.
2. **MDX body** at `content/models/<slug>.mdx`, registered in `content/registry.ts`.
3. **Exactly these sections, in this order** (`MODEL_SECTIONS` in `components/lesson/sections.ts`;
   Recall is appended automatically):
   `origin`, `hand`, `see`, `formula`, `knobs`, `failure`, `build`, `production`, `leads`,
   `paper`, `interview`.
   - `origin`: who invented it and **which limitation of the previous approach it fixed**, then
     the Bolt & Beam question it answers, then a `<KeyIdea>`.
   - `hand`: `<Steps>` on 5–8 rows with numbers chosen to come out clean. Every number must be
     asserted in `tests/models.test.ts`.
   - `see`: a `<Predict>`, the playground visual, 3–4 "try this" prompts.
   - `formula`: the math with `<Depth min={2}>` derivations and `<Depth min={3}>` theory.
   - `knobs`: each hyperparameter shown geometrically, ideally with one visual.
   - `failure`: `<FailureLab focus="<model id>" start="<scenario>" />` plus a "where it breaks /
     the fix" table and where it wins.
   - `build`: a `<PyRunner>` doing it from scratch in NumPy, then the library, with matching output.
   - `leads`: a `<Lineage self from to />` (slugs link to lessons automatically).
4. **Model code** lives in `lib/sim/` (`linreg.ts`, `tree.ts`, `gbm.ts`, `mlp.ts`). If the model is
   new to the Failure Lab, add it to `MODEL_IDS`, `MODEL_NAMES` and `fitModel` in
   `lib/sim/failureLab.ts`, give it a color in `components/viz/FailureLab.tsx`, and add a verdict
   for it to every scenario in `lib/sim/scenarios.ts`.
5. **Failure Lab claims are tested.** Every verdict a page or scenario makes ("the tree goes flat",
   "the line predicts negative sales") needs an assertion in the "Failure Lab claims" block of
   `tests/models.test.ts`. If a claim only holds for a lucky seed, reword it or test many seeds.
6. Flashcards (4+), optional Floor Check question, then the verification steps from `new-lesson`.

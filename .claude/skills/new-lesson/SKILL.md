---
name: new-lesson
description: Write a new Planogram lesson (or turn a planned bay into a ready one) in the house template. Use whenever adding or rewriting a lesson, a Keystone, a Bayes rung, a Model Lab page or a signature deep-dive lesson.
---

# Writing a Planogram lesson

The learner learns best **Concrete → Pictorial → Simulation → Formula**: numbers by hand first,
then a picture they can play with, then a simulation, and only then the formula as a summary of
what they already did. They are comfortable with Σ, algebra and derivatives; introduce integrals
as "Σ of thin bars" and matrices as "store × SKU tables". Every idea is rooted in the fictional
retailer **Bolt & Beam** (never a real company's data or branding).

## Checklist

1. **Curriculum entry** in `content/curriculum.ts`: set `status: "ready"`, keep `slug`, `aisle`,
   `week`, `prereqs` accurate, and add `minutes`. Add the slug to any Golden Thread it belongs to.
2. **MDX body** at `content/lessons/<aisle>/<slug>.mdx`. Register it in `content/registry.ts`.
   Model Lab pages (`kind: "model"`) live in `content/models/<slug>.mdx` and use a different
   section list: see `.claude/skills/new-model/SKILL.md`.
3. **Exactly these sections, in this order** (the Recall section is appended automatically):
   `floor`, `hand`, `see`, `simulate`, `formula`, `paper`, `build`, `production`, `interview`.
   - `floor`: a 3–6 sentence store story with a concrete decision at stake, plus a `<KeyIdea>`.
   - `hand`: `<Steps>` with real, small numbers that the reader can check with a pen.
   - `see`: a `<Predict>` question, then the interactive visual, then 3–4 "try this" prompts.
   - `simulate`: a browser simulation (TypeScript, seeded) showing the answer emerge.
   - `formula`: derive from the hand example. Put extra derivation in `<Depth min={2}>` and proofs
     or edge cases in `<Depth min={3}>`.
   - `paper`: 5–6 `<Exercise>` items (easy → hard) each with a `<Solution>`.
   - `build`: a `<PyRunner>` (NumPy/scipy/scikit-learn/xgboost/lightgbm all load in Pyodide).
   - `production`: how this works at retail scale and how it fails.
   - `interview`: 3–5 `<QA>` items and one `<Trap>`.
4. **Flashcards**: at least 4 in `content/cards.ts`. Ids are permanent once published.
5. **Floor Check** (optional): add a question to `content/checks.ts`; every wrong option needs a
   `misconception`.
6. **Visuals** go in `components/viz/`, built with `components/viz/kit.tsx` (scales, `Axis`,
   `Slider`, `Key`, `Tip`). Colors come from CSS tokens (`var(--series-1)` …, status colors only
   for state). Keep numeric logic in `lib/sim/` so vitest can check it. Register new components in
   `mdx-components.tsx`.
7. **Verify**: run `node scripts/index-exercises.mjs` (it lists every `<Exercise>` for the
   /exercises page; `npm test` fails if it's stale), then
   `npm run typecheck && npm run lint && npm test && npm run build`, then
   `npm run test:e2e`. Add an e2e test that moves a control and checks a number, and
   `PYODIDE_E2E=1 npx playwright test e2e/pyodide.spec.ts` after adding a `<PyRunner>`.
   Make sure every number written in the lesson matches what the visual and tests produce.

## MDX gotchas (each one has broken a build)

- `{` and `}` in prose start a JavaScript expression. Write `(−5)` rather than `{−5}`; inside
  `$…$` math they are fine.
- A bare `<` in prose starts a JSX tag. Use words, `≤`, or `\lt` / `\gt` inside math.
- `<PyRunner code={`…`} />` is a JS template literal: no backticks, no `${`, and no backslashes
  (`\n` would become a real newline inside a Python string).
- Put components on their own lines with blank lines around Markdown inside them, or they get
  wrapped in `<p>` and cause hydration errors.
- In GFM tables, write `\lvert x \rvert` instead of `|x|`.

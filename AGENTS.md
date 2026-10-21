# Planogram

A visual, first-principles learning site for retail math, data science, ML engineering and
agentic AI. Lessons are MDX with interactive React visuals; learner progress lives only in the
browser's localStorage.

## Where we are

M1, M2 and M3 (the no-API-key AI layer: the `tutor`, `feynman-grade`, `mock-interview` and
`project-grill` skills plus the "Ask Claude" panel) are done and live (Vercel deploys `main`).
M4 is weekly lesson batches: batch 1 (Bayes rungs 10–13), batches 2a, 2b and 2c (all of
Signature B, multi-store forecasting) and batch 3a (Signature D's elasticities and choice models)
are live. **Next is Signature D batch 3b: the causal core.** Read `docs/ROADMAP.md`
before starting work. It holds the status, the batch order for M4 onward and the per-batch
checklist. Update its Status section after each batch.

If `private/profile.md` exists, read it for the learner's career context and project details. It is
gitignored, and nothing from it may appear in a tracked file.

## Local setup

```bash
npm ci
npx playwright install chromium                  # for npm run test:e2e
pip install -r python/requirements.txt pytest     # for npm run test:py
python3 -m venv python/.venv && python/.venv/bin/pip install -r python/requirements-arena.txt   # arena only
```

## Working rules

- Ship in batches. Push to `main` only after typecheck, lint, vitest, pytest, build and
  e2e (`PYODIDE_E2E=1` when a page has a PyRunner) all pass.
- Assert every number written in a lesson in vitest from `lib/sim`, so the prose can't drift.
- Ask before outward-facing actions beyond the agreed batch push.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck`, `npm run lint`, `npm test` (vitest), `npm run test:e2e` (Playwright;
  set `PYODIDE_E2E=1` to also run the in-browser Python checks), `npm run test:py` (generator)
- `npm run data:sample` regenerates `public/data/boltbeam-sample.json`

## Layout

- `content/curriculum.ts`: aisles, lessons, prerequisites, Golden Threads, sprint weeks
- `content/lessons/**.mdx` + `content/registry.ts`: lesson bodies; `content/cards.ts`: flashcards;
  `content/checks.ts`: Floor Check questions and misconceptions
- `components/lesson/`: the lesson template; `components/viz/`: interactive visuals (`kit.tsx`
  holds the shared chart helpers); `lib/sim/`: the math behind the visuals, including from-scratch
  models (`linreg`, `tree`, `gbm`, `mlp`) and the Failure Lab scenarios (tested in `tests/`)
- `python/boltbeam/`: seeded synthetic retailer with planted ground truth, tested in `python/tests/`;
  `python/ladder/`: the from-scratch Metropolis sampler with R-hat and ESS (pytest checks it
  recovers a known Beta posterior)

To add or rewrite a lesson, follow `.claude/skills/new-lesson/SKILL.md`; for a Model Lab page
(`kind: "model"`, rendered at `/models/<slug>`), also follow `.claude/skills/new-model/SKILL.md`.

Never add real company data, client names or the learner's private notes (`/private/` is
gitignored).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

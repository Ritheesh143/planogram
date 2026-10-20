# Planogram

**The math behind the store, one aisle at a time.** Planogram is a visual, first-principles
learning site for retail mathematics, data science, ML engineering and agentic AI. In retail, a
planogram is the map of where every product sits on a shelf. Here it's the map of where every
idea sits.

Every lesson starts on the shop floor of **Bolt & Beam**, a fictional Indian home-improvement
chain. You work the idea by hand with real numbers, play with an interactive visual, simulate it,
and only then write the formula: **Concrete → Pictorial → Simulation → Formula**.

## What's built so far

**M2: the Model Lab and the Bayes ladder.** End-to-end pages for linear regression, decision trees, gradient
boosting, XGBoost vs LightGBM vs CatBoost and the MLP, each with a hand-worked example, a playground,
every hyperparameter visualized and a **Failure Lab** that trains all four model families live on
the same retail scenarios. Plus *Tree vs MLP*, Bayes rung 2 (losses as negative log-likelihoods) and
the **Model Arena**, a benchmark of ten real models on seven stress scenarios. Bayes rungs 3–9 (grid
posteriors to hierarchical pooling), the Math Toolkit, and Plan, Exercises, Concept Graph and Golden
Threads pages complete the milestone.

**M3: the AI layer, with no API key.** Every lesson and model page has an **Ask Claude** panel that
builds a prompt from the page's key ideas, the section you're in and your question, copies it and
opens claude.ai. Four Claude Code skills work from a local `claude` session against the lesson
sources: `/tutor`, `/feynman-grade`, `/mock-interview` and `/project-grill` (which reads your
gitignored `private/dossier/`).

**M4, batch 1: Bayes rungs 10–13.** *Why We Sample* (a bag of posterior draws instead of a grid),
*MCMC* (Metropolis by hand, HMC as a rolling ball, R-hat, ESS and divergences, with a pytest check
that the sampler recovers a known Beta posterior), *Bayesian A/B Testing* (P(B > A) and expected
loss by counting, and what peeking costs) and *The Bridge to Bayesian MMM* (collinear channels, a
posterior ridge, and priors plus a lift test that pick the point on it).

**M4, batch 2a: forecasting basics (Signature B).** *Anatomy of a Store Time Series* (trend,
weekday pattern and remainder, and what the ACF computes), *Baselines and Backtests* (seasonal
naive, rolling-origin folds, WAPE with bias and MASE, and why WAPE prefers zero for slow movers),
*Exponential Smoothing as Geometric Weights* (α from the signal-to-noise ratio) and *ARIMA
Intuition* (AR, MA and differencing read off the ACF and PACF, and the forecast fan).

### M1

- **Four Keystone lessons.** These are the ideas that unlock the rest of the store, and also
  common screening questions in senior data science interviews:
  1. *Counting Worlds:* Bayes' theorem as counting (is this return fraud?)
  2. *Run the A/B Test 100 Times:* what a 95% confidence interval really promises
  3. *The Likelihood Dial:* probability vs likelihood, MLE, and why losses are log-likelihoods
  4. *Boosting by Hand:* gradient boosting on six stores, checked against scikit-learn
- **A ten-section lesson template.** Floor Problem → By Hand → See It → Simulate → Formula →
  Pen and Paper → Build It (Python runs in the browser via Pyodide) → In Production →
  Interview Lens → Threads and Recall. An L1/L2/L3 depth toggle hides or reveals derivations
  and proofs.
- **Store map home page.** Aisles are tracks and bays are lessons, shaded by mastery. It covers
  about 80 lessons, from probability through Bayesian modelling, the Model Lab, retail signature
  projects (forecasting, cannibalization and halo, Bayesian MMM, embedding search), deep learning,
  agents, MLE and interview prep.
- **Floor Check.** A diagnostic quiz where every wrong option is tagged with the misconception it
  reveals and links to the lesson that fixes it.
- **Spaced-repetition review.** Uses FSRS (`ts-fsrs`) over each lesson's flashcards.
- **Bolt & Beam generator** (`python/boltbeam`). A seeded synthetic retailer with **planted
  ground truth**, so lessons can compare your estimate with the real answer:
  - own- and cross-price elasticities (substitutes and complements)
  - media adstock and saturation
  - Diwali and monsoon seasonality
  - stockouts that censor demand
  - a returns fraud flag

Progress, flashcard schedules and Floor Check history are stored **only in your browser**.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

## Test it

```bash
npm run typecheck && npm run lint
npm test               # vitest: curriculum structure, simulations vs closed forms, scoring, SRS
npm run test:py        # pytest: generator determinism and recoverability of planted truths
npm run build && npm run test:e2e          # Playwright against the production build
PYODIDE_E2E=1 npx playwright test e2e/pyodide.spec.ts   # runs every lesson's Python in the browser
```

The Python tests need `numpy`, `pandas` and `pytest` (`pip install -r python/requirements.txt`).

## Generate data

```bash
npm run data:sample    # small JSON extract used by the site (committed)
npm run data:full      # full CSV tables + truth.json in data/boltbeam (gitignored)
```

## Model Arena

The Model Arena page reads `public/data/arena.json`, produced offline with the real libraries
(scikit-learn, XGBoost, LightGBM, CatBoost) on Bolt & Beam weekly demand:

```bash
python3 -m venv --system-site-packages python/.venv
python/.venv/bin/pip install -r python/requirements.txt -r python/requirements-arena.txt
npm run data:arena     # about 10 minutes on a laptop; fixed seeds
npm run test:arena     # reproducibility and a from-scratch check against scikit-learn
```

## Deploy

The site is static apart from client-side state, so it deploys to Vercel with no configuration.
Import the repository and keep the defaults.

## Roadmap

| Milestone | Scope |
|---|---|
| M4+ | Weekly lesson batches in sprint order: forecasting and cannibalization signatures → MMM and search → deep learning, LLMs and agents → ML engineering, plus capstones on M5, Dunnhumby and Amazon ESCI |

The full plan, current status and per-batch checklist are in [`docs/ROADMAP.md`](docs/ROADMAP.md).
New lessons follow [`.claude/skills/new-lesson/SKILL.md`](.claude/skills/new-lesson/SKILL.md).

## Data and naming

Bolt & Beam is fictional. The site contains no real company data or branding. Personal notes
belong in `/private/`, which is gitignored.

# Planogram roadmap

The plan for the whole site, and where the build stands. A new agent session should read this
file after `AGENTS.md`, and should update the **Status** section after each batch.

If `private/profile.md` exists (it is gitignored), read it too. It holds the learner's career
context, project details and screening results. Never copy anything from it into a committed file.

## Status

| Milestone | State |
|---|---|
| **M1** Scaffold, Bolt & Beam generator, lesson template, store map, progress, FSRS review, Floor Check, the four Keystones | Done, live |
| **M2** Model Lab (linear regression, decision tree, gradient boosting, XGBoost vs LightGBM vs CatBoost, MLP), Model Arena + Failure Matrix, Tree vs MLP, Bayes rungs 2–9, Math Toolkit, Plan / Exercises / Concept Graph / Threads pages | Done, live |
| **M3** The AI layer, without an API key (spec below): `tutor`, `feynman-grade`, `mock-interview`, `project-grill` skills and the Ask Claude panel | Done, live. A manual run of each skill in a local `claude` session is still to do |
| **M4 onward** Weekly lesson batches in sprint order | **Next**: Bayes rungs 10–13 |

The site deploys to Vercel from `main` on GitHub. Every push to `main` redeploys it.

### Live lessons
- **Foundations:** counting-worlds, ci-repeat, likelihood-dial, integrals-thin-bars,
  vectors-baskets, matrices-tables
- **Bayes:** mle-peak (rung 2), posterior-grid (3), beta-binomial (4), gamma-poisson (5),
  priors-defend (6), shrinkage (7), bayes-linreg (8), hierarchical-pooling (9)
- **Models (lessons):** boosting-by-hand, tree-vs-mlp
- **Model Lab (`/models/<slug>`):** linear-regression, decision-tree, gradient-boosting,
  xgb-lgbm-catboost, mlp, model-arena

All other bays in `content/curriculum.ts` are `planned`. Turning a planned bay into a ready lesson
follows `.claude/skills/new-lesson/SKILL.md`.

## The learner, in brief

The learner is a working data scientist (about four years of experience) aiming for Senior Data
Scientist or Applied Scientist roles with a GenAI edge. They target an offer in hand within 3–4
months, then a further jump within two years. The detailed figures are in the private profile.

Their own projects, which the Signature deep dives master:
- Bayesian marketing-mix modelling
- multi-store demand forecasting
- embedding similarity search
- cannibalization and halo analysis

The screening results shaped the teaching:
- **What they got right:** a subgroup-count question (paint → brush = 25%).
- **What they missed:** the base-rate fraud question, what a 95% CI means, likelihood vs
  probability, and what each boosting tree fits.
- **Bayes:** every one of the classic pain points applies: a parameter as a distribution, the math
  machinery, MCMC, and choosing priors.
- **How they learn:** numbers, then pictures, then simulation, then the formula.
- **Math background:** comfortable with Σ, algebra and derivatives; integrals and matrices are
  taught just in time (integrals as Σ of thin bars, matrices as store × SKU tables).

## M3: the AI layer, with no API key

The learner has a Claude subscription and **no Anthropic API key**, so M3 adds no API routes,
server secrets or passcodes. The AI features run in two places.

### 1. Claude Code skills in `.claude/skills/`
These are used from a local `claude` session. Each skill reads the lesson MDX (and `lib/sim/` for
the numbers), so its answers match the site exactly.

- **`tutor`**: given a lesson slug and a question, explain it in the house order (numbers, then a
  picture, then a simulation, then the formula), using that lesson's worked numbers. It points to
  the section and exercise that cover the question.
- **`feynman-grade`**: the learner explains a concept in their own words. The skill grades the
  explanation against the lesson's key ideas and the misconceptions in `content/checks.ts`. It
  returns what was right, what is missing or wrong (with the misconception tag), one follow-up
  question, and the lesson section to reread.
- **`mock-interview`**: a Senior DS / Applied Scientist screen. It asks one question at a time from
  the Interview Lens sections and the Checkout aisle, waits for each answer, then scores it and
  gives a model answer. It ends with a summary and the lessons to review.
- **`project-grill`**: reads `private/dossier/*.md` (the learner's own project notes, gitignored)
  and grills them on their projects the way a hiring manager would: why this method, how you
  validated it, what failed, what you'd do differently. If the dossier is missing, it asks the
  learner to create it, starting from a template the skill prints.

Each skill gets a `SKILL.md` that says which files to read, the output shape, and never to write
private content into tracked files.

### 2. "Ask Claude" on the site
This is a small client component on every lesson and model page (in the `LessonShell` footer, and
in a section's menu if that's cheap):
- It builds a prompt with the lesson title, its key ideas, the section the learner is in, and a
  question box.
- It copies the prompt to the clipboard and opens `https://claude.ai/new`, where the learner pastes
  it.
- It needs no network calls from the site itself. It has vitest coverage of the prompt builder and
  a Playwright check that the button copies text.

The source of a lesson's key ideas is the same data the flashcards use (`content/cards.ts`), so no
new authoring is needed.

### M3 verification
- Run the usual checks, plus a quick manual run of each skill in a local `claude` session against
  one lesson.

## M4 onward: weekly batches, in sprint order

Draft each batch about a week ahead of the learner's sprint. Each batch is verified, committed and
pushed on its own.

1. **Bayes rungs 10–13:**
   - **10, "why sample":** the grid explodes, so keep a bag of 4,000 plausible values; its
     histogram *is* the posterior.
   - **11, MCMC (`mcmc-walker`):**
     - A Metropolis walker taken 5 steps by hand, then animated.
     - HMC/NUTS as a rolling ball.
     - R-hat, ESS and divergences shown visually.
     - A pytest check that the Metropolis sampler recovers a known Beta posterior.
   - **12, Bayesian A/B testing:** P(B > A) by counting samples.
   - **13:** the bridge into Bayesian MMM.
2. **Signature B (multi-store forecasting), about 12 lessons:**
   - Forecasting basics: STL decomposition and the ACF; baselines and rolling-origin CV with
     WAPE, MASE and bias; ETS as geometric weights; ARIMA intuition.
   - Hard demand: censored demand from stockouts; Croston and TSB for intermittent demand.
   - Global models: a global LightGBM with the Tweedie loss derived; MinT reconciliation as a
     projection.
   - Uncertainty: pinball loss → quantile (with proof) and conformal intervals.
   - Promotions: promos and the post-promo dip.
   - Modern models: DeepAR, TFT and foundation models (Chronos, TimesFM).
   - At scale: forecasting at scale and the step from forecast to safety stock.
3. **Signature D (cannibalization and halo):**
   - Definitions, and why item lift ≠ category incrementality.
   - Cross-price elasticity and the sign of substitutes vs complements.
   - MNL from random utility (Gumbel → softmax), IIA and nested logit.
   - Log-log models and price endogeneity; hierarchical Bayesian elasticities.
   - DiD and synthetic control; double ML, visualized.
   - Stockouts as natural experiments for demand transfer.
   - Net promo ROI and assortment delisting.
   - Plus the causal-inference core lessons.
4. **Signature A (Bayesian MMM):**
   - The question and the trap: incrementality, ROI vs marginal ROI; why naive regression on
     spend lies.
   - Media effects: adstock (geometric and Weibull, half-life); Hill saturation, whose derivative
     gives marginal ROI.
   - The Bayesian core: priors, MCMC diagnostics, identifiability, hierarchical geo models.
   - Calibration and planning: seasonality and controls; geo-lift calibration; budget
     optimization with Lagrange multipliers (equalize marginal ROI).
   - Tools and trust: PyMC-Marketing vs Meridian vs Robyn; "how do you know it's right?"
5. **Signature C (embedding search):**
   - Similarity basics: cosine vs dot product, distance concentration.
   - Lexical search: TF-IDF and BM25.
   - Embeddings: word2vec and item2vec as PMI factorization; InfoNCE; two-tower retrieval.
   - Approximate nearest neighbours: IVF, HNSW (animated), PQ.
   - Ranking: hybrid search with RRF and re-rankers; NDCG derived.
   - "Similar ≠ substitute," using the ESCI labels.
   - Search → RAG → agent tool.
6. **Deep learning → LLMs → agents:**
   - Deep learning: an optimizer race, embeddings, CNNs on product images, a transformer from
     scratch.
   - LLMs: tokenization, LoRA (tied back to SVD), RLHF/DPO, inference, RAG over the catalog, evals.
   - Agents: tool use, ReAct, memory, multi-agent setups, MCP servers, agent evals, guardrails,
     shopping agents.
7. **ML engineering:**
   - Data: SQL in depth, Spark, feature stores.
   - Deployment: serving, MLOps and CI/CD.
   - Monitoring: drift (PSI/KL), LLMOps.
   - Interview prep: ML system design built on the learner's projects.
8. **Checkout:**
   - Stats puzzles.
   - STAR stories.
   - Negotiation.
9. **Classical ML extras, slotted in where they fit:**
   - Regularization geometry, clustering, anomaly detection, retail metrics.
   - An Interpretability section on each model page: SHAP vs gain vs split count, PDP and ICE.

### Capstones (public data, run alongside)
1. **M5 forecasting.**
   - Build a hierarchical probabilistic forecast, comparing LightGBM-Tweedie with a foundation
     model.
   - Reconcile the hierarchy with MinT.
   - Serve it with FastAPI and add drift monitoring.
2. **Bayesian MMM from scratch.**
   - Recover the planted Bolt & Beam truth.
   - Compare the result against PyMC-Marketing and Meridian.
   - Add a budget optimizer.
3. **Cannibalization and halo estimator.**
   - Estimate a cross-elasticity matrix with double ML.
   - Add a net-promo-ROI simulator.
4. **Hybrid product search on ESCI, leading to a DIY Project Copilot agent.**
   - The agent uses search, a quantity calculator and an inventory check via MCP.
   - Ship it with an eval suite.

## The 16-week sprint
The sprint is also in `content/plan.ts` and on `/plan`. Plan about 12–15 hours a week.

| Weeks | Focus |
|---|---|
| 1–2 | The four Keystones, Math Toolkit, Bayes rungs 0–3, A/B testing and power, with daily DSA and SQL |
| 3–4 | Model Lab core, Tree vs MLP, Bayes rungs 4–9 |
| 5–6 | Signatures B and D plus the causal core. Rewrite the resume, and start applying and asking for referrals by week 6 |
| 7–8 | Bayes rungs 10–13, then Signature A (MMM) and Signature C (search), with Project Grill drills |
| 9–10 | Deep learning → transformers → LLMs → RAG → agents. Ship the DIY Copilot |
| 11–12 | ML system design on the learner's own projects, and MLOps essentials |
| 13–16 | Interview loops, mock interviews, negotiation |

## Design reference

### Lesson template (`kind: "lesson"`)
The order is Concrete → Pictorial → Simulation → Formula, and the formula always comes last.
The sections are:
1. Floor Problem
2. By Hand
3. See It
4. Simulate
5. Formula
6. Pen and Paper
7. Build It (Pyodide)
8. In Production
9. Interview Lens
10. Threads and Recall

`<Depth min>` blocks give the L1/L2/L3 depth levels.

### Model Lab arc (`kind: "model"`, `MODEL_SECTIONS` in `components/lesson/sections.ts`)
1. origin
2. hand
3. see
4. formula
5. knobs
6. failure
7. build
8. production
9. leads
10. paper
11. interview
12. recall

The Failure Lab (`components/viz/FailureLab.tsx`) trains every model family live on the same
scenarios.

### Golden Threads
- **Geometric decay:** adstock → exponential smoothing → Adam momentum → RL discount γ
- **Softmax:** MNL → logistic regression → InfoNCE → attention → LLMs
- **Projection:** least squares → MinT reconciliation → PCA
- **Likelihood ↔ loss:** Gaussian → MSE; Poisson/Tweedie → retail losses; Bernoulli →
  cross-entropy
- **Priors = shrinkage:** ridge → hierarchical Bayes → partial pooling
- **Low rank:** PCA → word2vec → matrix factorization → LoRA
- **Dot product:** basket similarity → regression → cosine search → attention

## Checklist for every batch
1. Follow the new-lesson skill (and the new-model skill for Model Lab pages). Each lesson needs:
   - 5–6 exercises with solutions and at least 4 flashcards.
   - A PyRunner, an Interview Lens with a Trap, and a Floor Check question where one fits.
2. Assert every number written in the MDX in vitest from `lib/sim`.
3. Charts follow the dataviz rules in `components/viz/kit.tsx` and `app/globals.css`, using the
   series and sequential tokens and the `on-seq` label tokens.
4. Verify with:
   - `npm run typecheck && npm run lint && npm test && npm run test:py && npm run build`
   - `PYODIDE_E2E=1 npm run test:e2e`, with screenshots at 1280 and 375 px and no horizontal
     scroll.
5. Commit, push to `main`, and check that `git ls-remote origin main` matches HEAD.
6. Update the **Status** section of this file.

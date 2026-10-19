// Single source of truth for the store map, lesson pages, prerequisites,
// Golden Threads and the sprint order. Validated by lib/curriculum.ts.

type LessonInput = {
  slug: string;
  aisle: string;
  title: string;
  kind?: "lesson" | "model";
  status?: "ready" | "planned";
  keystone?: number;
  week?: number;
  minutes?: number;
  summary: string;
  prereqs?: string[];
};

export const aisles = [
  { id: "foundations", number: "0", name: "Thinking Tools", tagline: "Probability, statistics and the math toolkit, built from store mechanics" },
  { id: "bayes", number: "1", name: "Bayesian, Finally", tagline: "One new idea per rung, from counting to MCMC to MMM" },
  { id: "models", number: "2", name: "Model Lab", tagline: "Each model end to end: by hand, the math, where it breaks, where it leads" },
  { id: "retail", number: "3", name: "Retail Science", tagline: "Your four signature projects, mastered" },
  { id: "deep", number: "4", name: "Deep Learning & LLMs", tagline: "From one neuron to transformers, LoRA and RAG" },
  { id: "agents", number: "5", name: "Agentic AI", tagline: "Tools, planning, MCP and evals, with a DIY Project Copilot" },
  { id: "mle", number: "6", name: "ML Engineering", tagline: "SQL, serving, MLOps and drift, the production view" },
  { id: "checkout", number: "7", name: "Checkout", tagline: "System design, interview drills and negotiation" },
];

const raw: LessonInput[] = [
  // Aisle 0: Thinking Tools
  { slug: "counting-worlds", aisle: "foundations", title: "Counting Worlds: Is This Return Fraud?", status: "ready", keystone: 1, week: 1, minutes: 45, summary: "Bayes' theorem as plain counting. 1,000 returns, a fraud flag, and why a 90%-accurate model is right only 15% of the time." },
  { slug: "ci-repeat", aisle: "foundations", title: "Run the A/B Test 100 Times", status: "ready", keystone: 2, week: 1, minutes: 45, summary: "What a 95% confidence interval really promises, shown by re-running an endcap experiment a hundred times.", prereqs: ["counting-worlds"] },
  { slug: "likelihood-dial", aisle: "foundations", title: "The Likelihood Dial", status: "ready", keystone: 3, week: 1, minutes: 50, summary: "Probability fixes the parameter and varies the data. Likelihood fixes the data and varies the parameter. MLE is the top of the dial.", prereqs: ["counting-worlds"] },
  { slug: "integrals-thin-bars", aisle: "foundations", title: "Integrals as Σ of Thin Bars", status: "ready", week: 2, minutes: 40, summary: "An integral is a sum of very thin bars. You already know Σ, so you already know integrals.", prereqs: [] },
  { slug: "poisson-paint-counter", aisle: "foundations", title: "Where Poisson Comes From", week: 2, summary: "Slice an hour at the paint counter into tiny intervals and watch the Binomial turn into Poisson.", prereqs: ["counting-worlds"] },
  { slug: "clt-weekly-sales", aisle: "foundations", title: "Why Weekly Sales Look Normal", week: 2, summary: "The central limit theorem from many small, independent purchases.", prereqs: ["poisson-paint-counter"] },
  { slug: "ab-power-cuped", aisle: "foundations", title: "How Many Stores Do We Need? Power and CUPED", week: 2, summary: "Sample size, power and variance reduction for store experiments.", prereqs: ["ci-repeat", "clt-weekly-sales"] },
  { slug: "safety-stock-variance", aisle: "foundations", title: "Safety Stock: Why Variances Add", week: 2, summary: "z·σ·√L derived from adding up the variance of independent days.", prereqs: ["clt-weekly-sales"] },
  { slug: "risk-pooling", aisle: "foundations", title: "Risk Pooling: One Warehouse or Forty?", week: 5, summary: "σ√N vs Nσ, and why a central warehouse needs less safety stock.", prereqs: ["safety-stock-variance"] },
  { slug: "basket-lift", aisle: "foundations", title: "Basket Lift as an Independence Test", week: 5, summary: "Lift = P(A∩B) / (P(A)·P(B)), derived by counting baskets.", prereqs: ["counting-worlds"] },
  { slug: "simpsons-paradox", aisle: "foundations", title: "Simpson's Paradox in Store Formats", week: 5, summary: "A promo that looks bad overall but helps every store format.", prereqs: ["counting-worlds"] },
  { slug: "vectors-baskets", aisle: "foundations", title: "Vectors as Baskets", status: "ready", week: 3, minutes: 40, summary: "A basket is a vector, and the dot product measures overlap.", prereqs: [] },
  { slug: "matrices-tables", aisle: "foundations", title: "Matrices as Store × SKU Tables", status: "ready", week: 3, minutes: 45, summary: "Matrix multiplication is many dot products at once.", prereqs: ["vectors-baskets"] },
  { slug: "elasticity-derivative", aisle: "foundations", title: "Elasticity Is a Derivative", week: 5, summary: "Price elasticity as the slope of log-demand against log-price.", prereqs: [] },
  { slug: "lagrange-budget", aisle: "foundations", title: "Lagrange Multipliers for a Budget", week: 7, summary: "Why the optimal media budget equalizes marginal ROI across channels.", prereqs: ["elasticity-derivative"] },

  // Aisle 1: Bayesian, Finally
  { slug: "mle-peak", aisle: "bayes", title: "MLE and Losses as Negative Log-Likelihood", status: "ready", week: 2, minutes: 50, summary: "MSE is Gaussian MLE, cross-entropy is Bernoulli MLE, Tweedie is compound Poisson-gamma MLE.", prereqs: ["likelihood-dial"] },
  { slug: "posterior-grid", aisle: "bayes", title: "A Grid of Hypotheses", status: "ready", week: 2, minutes: 50, summary: "Prior bars × likelihood bars, divide by the Σ: a parameter as a distribution, made concrete.", prereqs: ["likelihood-dial", "counting-worlds"] },
  { slug: "beta-binomial", aisle: "bayes", title: "Beta–Binomial: Endcap Conversion", status: "ready", week: 3, minutes: 50, summary: "Update a conversion rate customer by customer.", prereqs: ["posterior-grid", "integrals-thin-bars"] },
  { slug: "gamma-poisson", aisle: "bayes", title: "Gamma–Poisson: A Store's Demand Rate", status: "ready", week: 3, minutes: 50, summary: "The posterior predictive is the negative binomial, which explains over-dispersion.", prereqs: ["beta-binomial", "poisson-paint-counter"] },
  { slug: "priors-defend", aisle: "bayes", title: "Priors You Can Defend", status: "ready", week: 4, minutes: 50, summary: "Prior predictive simulation, weakly informative priors and priors from lift tests.", prereqs: ["gamma-poisson"] },
  { slug: "shrinkage", aisle: "bayes", title: "Shrinkage: The New Store Problem", status: "ready", week: 4, minutes: 50, summary: "A new store with two weeks of data gets pulled toward the chain average.", prereqs: ["priors-defend"] },
  { slug: "bayes-linreg", aisle: "bayes", title: "Bayesian Linear Regression", status: "ready", week: 4, minutes: 55, summary: "Fifty plausible lines instead of one, and ridge as MAP.", prereqs: ["shrinkage", "linear-regression"] },
  { slug: "hierarchical-pooling", aisle: "bayes", title: "Hierarchical Models Across 40 Stores", status: "ready", week: 4, minutes: 60, summary: "No pooling, complete pooling and partial pooling, side by side.", prereqs: ["shrinkage"] },
  { slug: "why-sample", aisle: "bayes", title: "Why We Sample", week: 7, summary: "The grid explodes in high dimensions, so keep a bag of plausible values instead.", prereqs: ["hierarchical-pooling"] },
  { slug: "mcmc-walker", aisle: "bayes", title: "MCMC: The Walker, the Ball and the Diagnostics", week: 7, summary: "Metropolis by hand, HMC/NUTS as a rolling ball, and R-hat, ESS and divergences.", prereqs: ["why-sample"] },
  { slug: "bayes-ab", aisle: "bayes", title: "Bayesian A/B Testing", week: 7, summary: "P(B > A) and expected loss by counting posterior samples.", prereqs: ["mcmc-walker", "ci-repeat"] },

  // Aisle 2: Model Lab
  { slug: "boosting-by-hand", aisle: "models", title: "Boosting by Hand on 6 Rows", status: "ready", keystone: 4, week: 1, minutes: 50, summary: "Each new tree fits what the previous trees got wrong. Residuals, learning rate and the gradient, all on six stores.", prereqs: [] },
  { slug: "linear-regression", aisle: "models", kind: "model", title: "Linear Regression, End to End", status: "ready", week: 3, minutes: 75, summary: "OLS via derivatives, projection, Ridge/Lasso, GLMs and Bayesian regression.", prereqs: ["mle-peak"] },
  { slug: "decision-tree", aisle: "models", kind: "model", title: "Decision Trees, End to End", status: "ready", week: 3, minutes: 70, summary: "CART by hand, Gini and entropy, split search and pruning.", prereqs: [] },
  { slug: "gradient-boosting", aisle: "models", kind: "model", title: "Gradient Boosting, End to End", status: "ready", week: 3, minutes: 75, summary: "GBM as gradient descent in function space, then XGBoost's second-order step.", prereqs: ["boosting-by-hand", "decision-tree"] },
  { slug: "xgb-lgbm-catboost", aisle: "models", kind: "model", title: "XGBoost vs LightGBM vs CatBoost", status: "ready", week: 4, minutes: 70, summary: "Level-wise vs leaf-wise growth, histograms, GOSS, EFB and ordered target statistics.", prereqs: ["gradient-boosting"] },
  { slug: "mlp", aisle: "models", kind: "model", title: "The MLP, End to End", status: "ready", week: 4, minutes: 75, summary: "One neuron by hand, ReLU kinks building a demand curve, backprop as the chain rule.", prereqs: ["linear-regression"] },
  { slug: "tree-vs-mlp", aisle: "models", title: "Tree vs MLP: Boxes vs Bends", status: "ready", week: 4, minutes: 45, summary: "Piecewise constant vs piecewise linear, and why trees cannot extrapolate a trend.", prereqs: ["decision-tree", "mlp"] },
  { slug: "model-arena", aisle: "models", kind: "model", title: "Model Arena and the Failure Matrix", status: "ready", week: 4, minutes: 60, summary: "Every model on one demand task, scored on each failure scenario.", prereqs: ["xgb-lgbm-catboost", "mlp"] },

  // Aisle 3: Retail Science (signatures)
  { slug: "fc-anatomy", aisle: "retail", title: "Forecasting: Anatomy of a Store Time Series", week: 5, summary: "STL decomposition and what the ACF really computes.", prereqs: ["clt-weekly-sales"] },
  { slug: "fc-censored-demand", aisle: "retail", title: "Demand ≠ Sales: Stockouts Censor Demand", week: 5, summary: "Correcting forecasts when the shelf ran empty.", prereqs: ["fc-anatomy", "likelihood-dial"] },
  { slug: "fc-tweedie-lgbm", aisle: "retail", title: "Global LightGBM and the Tweedie Loss", week: 5, summary: "Why sales with many zeros need Tweedie, derived.", prereqs: ["gradient-boosting", "mle-peak"] },
  { slug: "fc-mint", aisle: "retail", title: "Hierarchical Reconciliation as Projection", week: 6, summary: "Store, region and national forecasts made coherent with MinT.", prereqs: ["fc-anatomy", "matrices-tables"] },
  { slug: "fc-pinball", aisle: "retail", title: "Pinball Loss Gives Quantiles", week: 6, summary: "A proof that minimizing pinball loss yields a quantile, and conformal intervals.", prereqs: ["fc-anatomy"] },
  { slug: "cx-cross-elasticity", aisle: "retail", title: "Cannibalization vs Halo: Cross-Price Elasticity", week: 5, summary: "The sign of the cross-elasticity tells substitutes from complements.", prereqs: ["elasticity-derivative"] },
  { slug: "cx-mnl", aisle: "retail", title: "Choice Models: Gumbel Errors Give Softmax", week: 6, summary: "The multinomial logit from random utility, IIA and nested logit.", prereqs: ["cx-cross-elasticity", "mle-peak"] },
  { slug: "cx-double-ml", aisle: "retail", title: "Double ML for Elasticities", week: 6, summary: "What orthogonalization actually means, visualized.", prereqs: ["cx-cross-elasticity", "linear-regression"] },
  { slug: "cx-stockout-experiments", aisle: "retail", title: "Stockouts as Natural Experiments", week: 6, summary: "Demand transfer reveals substitutes.", prereqs: ["cx-cross-elasticity"] },
  { slug: "mmm-adstock-saturation", aisle: "retail", title: "Adstock and Saturation", week: 7, summary: "The shape of advertising memory and diminishing returns.", prereqs: ["elasticity-derivative"] },
  { slug: "mmm-bayesian", aisle: "retail", title: "Bayesian MMM From Scratch", week: 8, summary: "Priors, MCMC diagnostics and identifiability for a media mix model.", prereqs: ["mmm-adstock-saturation", "mcmc-walker", "bayes-linreg"] },
  { slug: "mmm-calibration", aisle: "retail", title: "Calibrating MMM With Geo-Lift Tests", week: 8, summary: "Experiments as priors, and how you know the model is right.", prereqs: ["mmm-bayesian", "ab-power-cuped"] },
  { slug: "mmm-budget", aisle: "retail", title: "Budget Optimization: Equalize Marginal ROI", week: 8, summary: "Response curves and the Lagrange solution.", prereqs: ["mmm-bayesian", "lagrange-budget"] },
  { slug: "search-bm25", aisle: "retail", title: "From TF-IDF to BM25", week: 8, summary: "IDF derived as −log p, and lexical search done properly.", prereqs: ["vectors-baskets"] },
  { slug: "search-contrastive", aisle: "retail", title: "Contrastive Learning and InfoNCE", week: 8, summary: "InfoNCE as softmax cross-entropy, temperature and hard negatives.", prereqs: ["search-bm25", "mle-peak"] },
  { slug: "search-ann", aisle: "retail", title: "ANN Search: IVF, HNSW, PQ", week: 8, summary: "The recall vs latency trade-off, animated.", prereqs: ["search-contrastive"] },
  { slug: "search-similar-not-substitute", aisle: "retail", title: "Similar ≠ Substitute", week: 8, summary: "A drill and drill bits are close in embedding space but are complements.", prereqs: ["search-ann", "cx-cross-elasticity"] },

  // Aisle 4: Deep Learning & LLMs
  { slug: "dl-backprop", aisle: "deep", title: "Backprop Visualized", week: 9, summary: "The chain rule flowing backward through a small network.", prereqs: ["mlp"] },
  { slug: "dl-optimizers", aisle: "deep", title: "The Optimizer Race", week: 9, summary: "SGD, momentum and Adam on the same loss surface.", prereqs: ["dl-backprop"] },
  { slug: "dl-embeddings", aisle: "deep", title: "Embeddings: Products as Points", week: 9, summary: "Learned vectors for SKUs, and what their geometry means.", prereqs: ["vectors-baskets", "dl-backprop"] },
  { slug: "dl-attention", aisle: "deep", title: "Attention Reads a Product Title", week: 9, summary: "Queries, keys and values on 'cordless drill 20V 2 batteries'.", prereqs: ["dl-embeddings", "matrices-tables"] },
  { slug: "dl-transformer", aisle: "deep", title: "A Transformer From Scratch", week: 9, summary: "Build a tiny transformer and watch it learn.", prereqs: ["dl-attention"] },
  { slug: "llm-lora", aisle: "deep", title: "LoRA Is Low Rank", week: 10, summary: "Fine-tuning through the lens of SVD.", prereqs: ["dl-transformer"] },
  { slug: "llm-rag", aisle: "deep", title: "RAG Over a Product Catalog", week: 10, summary: "Retrieval, grounding and evaluation.", prereqs: ["search-ann", "dl-transformer"] },
  { slug: "llm-evals", aisle: "deep", title: "Evaluating LLM Systems", week: 10, summary: "Golden sets, LLM-as-judge and its pitfalls.", prereqs: ["llm-rag"] },

  // Aisle 5: Agentic AI
  { slug: "agent-tool-use", aisle: "agents", title: "Tool Use and the ReAct Loop", week: 10, summary: "How an agent decides, acts and observes, traced step by step.", prereqs: ["llm-rag"] },
  { slug: "agent-mcp", aisle: "agents", title: "MCP Servers: Giving Agents a Catalog", week: 10, summary: "Expose search, inventory and calculators as tools.", prereqs: ["agent-tool-use"] },
  { slug: "agent-evals", aisle: "agents", title: "Agent Evals and Guardrails", week: 10, summary: "Measuring task success, cost and safety.", prereqs: ["agent-tool-use", "llm-evals"] },
  { slug: "agent-diy-copilot", aisle: "agents", title: "Capstone: DIY Project Copilot", week: 10, summary: "\"Build a 10×12 ft deck\": plan, search, compute quantities, check inventory.", prereqs: ["agent-mcp", "agent-evals", "search-similar-not-substitute"] },

  // Aisle 6: ML Engineering
  { slug: "mle-sql", aisle: "mle", title: "SQL in Depth: Window Functions for Retail", week: 11, summary: "Rolling demand, ranks and gaps, the way interviews ask.", prereqs: [] },
  { slug: "mle-serving", aisle: "mle", title: "Batch vs Real-Time Serving", week: 11, summary: "Latency budgets, feature stores and caching.", prereqs: ["mle-sql"] },
  { slug: "mle-mlops", aisle: "mle", title: "MLOps: Tracking, Registry, CI/CD", week: 11, summary: "From notebook to a reproducible pipeline.", prereqs: ["mle-serving"] },
  { slug: "mle-drift", aisle: "mle", title: "Drift: PSI and KL", week: 12, summary: "Monitoring distribution shift, tied back to cross-entropy.", prereqs: ["mle-mlops", "mle-peak"] },
  { slug: "mle-spark", aisle: "mle", title: "Forecasting Millions of Series With Spark", week: 12, summary: "Partitioning, pandas UDFs and backtest harnesses.", prereqs: ["mle-serving", "fc-tweedie-lgbm"] },

  // Aisle 7: Checkout
  { slug: "sd-forecasting", aisle: "checkout", title: "System Design: Forecasting for 10k Stores", week: 11, summary: "The full design, built on your forecasting project.", prereqs: ["fc-mint", "mle-spark"] },
  { slug: "sd-search", aisle: "checkout", title: "System Design: Product Search", week: 12, summary: "Retrieval, ranking and evaluation at scale.", prereqs: ["search-ann", "mle-serving"] },
  { slug: "sd-mmm", aisle: "checkout", title: "System Design: An MMM Platform", week: 12, summary: "Data, modeling, calibration and the budget tool.", prereqs: ["mmm-budget"] },
  { slug: "stats-puzzles", aisle: "checkout", title: "Stats Puzzles Interviewers Love", week: 13, summary: "Base rates, coverage, likelihood and expected value, timed.", prereqs: ["counting-worlds", "ci-repeat", "likelihood-dial"] },
  { slug: "star-stories", aisle: "checkout", title: "STAR Stories From Your Projects", week: 6, summary: "Quantified, defensible stories, kept in your private dossier.", prereqs: [] },
  { slug: "negotiation", aisle: "checkout", title: "Negotiating the Offer", week: 14, summary: "Anchors, competing offers and total compensation.", prereqs: [] },
];

export const lessons = raw.map((l) => ({
  kind: "lesson" as const,
  status: "planned" as const,
  prereqs: [],
  ...l,
}));

export const threads = [
  { id: "likelihood-loss", name: "Likelihood ↔ Loss", idea: "Every loss function is a negative log-likelihood in disguise.", steps: ["likelihood-dial", "mle-peak", "fc-tweedie-lgbm", "search-contrastive", "mle-drift"] },
  { id: "priors-shrinkage", name: "Priors = Shrinkage", idea: "A prior pulls noisy estimates toward something sensible.", steps: ["counting-worlds", "posterior-grid", "shrinkage", "bayes-linreg", "hierarchical-pooling", "mmm-bayesian"] },
  { id: "geometric-decay", name: "Geometric Decay", idea: "Yesterday matters a fraction θ as much as today.", steps: ["mmm-adstock-saturation", "fc-anatomy", "dl-optimizers"] },
  { id: "softmax", name: "Softmax", idea: "Turn scores into probabilities by exponentiating and normalizing.", steps: ["cx-mnl", "search-contrastive", "dl-attention", "dl-transformer"] },
  { id: "projection", name: "Projection", idea: "Find the closest point in an allowed space.", steps: ["matrices-tables", "linear-regression", "fc-mint"] },
  { id: "gradient", name: "Gradient", idea: "Move a little in the direction that reduces the error.", steps: ["boosting-by-hand", "gradient-boosting", "dl-backprop", "dl-optimizers"] },
  { id: "dot-product", name: "Dot Product", idea: "Overlap between two lists of numbers.", steps: ["vectors-baskets", "linear-regression", "search-ann", "dl-attention"] },
  { id: "sampling-distribution", name: "Repeat the World", idea: "Uncertainty is what changes when you re-run the world.", steps: ["ci-repeat", "ab-power-cuped", "why-sample", "bayes-ab"] },
];

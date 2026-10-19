// The career side of the plan: what to do each sprint week besides lessons, and the longer
// marathon milestones. Lessons themselves come from each lesson's `week` in curriculum.ts.
// Ids are stored in the learner's browser, so keep them stable once published.

export type PlanTask = { id: string; week: number; text: string; kind: "career" | "practice" | "build" };

export const sprintFocus: Record<number, string> = {
  1: "The four Keystones: Bayes as counting, confidence intervals, likelihood, boosting by hand",
  2: "Bayes rungs 2–3, the Math Toolkit, A/B testing and power",
  3: "Model Lab core: linear regression, trees, gradient boosting",
  4: "XGBoost vs LightGBM vs CatBoost, the MLP, the Arena; Bayes rungs 4–9",
  5: "Forecasting and cannibalization signatures; resume rewrite",
  6: "Causal core; start applying",
  7: "MCMC and Bayesian MMM",
  8: "MMM calibration and budgets; embedding search",
  9: "Deep learning to transformers",
  10: "LLMs, RAG and agents; ship the DIY Copilot",
  11: "ML system design and MLOps",
  12: "System design drills and drift monitoring",
  13: "Interview loops",
  14: "Negotiation and offers",
  15: "Interview loops, continued",
  16: "Decide, give notice, plan the first 90 days",
};

export const sprintTasks: PlanTask[] = [
  { id: "w1-dsa", week: 1, kind: "practice", text: "Block a daily 45-minute slot for DSA and SQL practice (one LeetCode medium or one window-function problem a day)" },
  { id: "w1-check", week: 1, kind: "practice", text: "Take the Floor Check and write down your three weakest misconceptions" },
  { id: "w2-review", week: 2, kind: "practice", text: "Clear the review deck every day this week" },
  { id: "w3-check", week: 3, kind: "practice", text: "Retake the Floor Check and compare with week 1" },
  { id: "w3-arena", week: 3, kind: "build", text: "Run the Model Arena locally and explain one column to a friend" },
  { id: "w4-dossier", week: 4, kind: "career", text: "Start the private project dossier: one page per past project (problem, data, model, impact, what you'd do differently)" },
  { id: "w5-resume", week: 5, kind: "career", text: "Rewrite your resume around the four projects, each with a measured outcome (₹, %, hours saved)" },
  { id: "w5-star", week: 5, kind: "career", text: "Draft STAR stories for the four projects (keep them in /private, not the public repo)" },
  { id: "w5-check", week: 5, kind: "practice", text: "Floor Check retake" },
  { id: "w6-targets", week: 6, kind: "career", text: "List 15 target companies and roles; verify bands on levels.fyi and with peers" },
  { id: "w6-referrals", week: 6, kind: "career", text: "Ask for at least 5 referrals and send the first applications" },
  { id: "w7-grill-mmm", week: 7, kind: "practice", text: "Project Grill drill: defend your MMM work for 30 minutes (priors, identifiability, calibration)" },
  { id: "w7-check", week: 7, kind: "practice", text: "Floor Check retake" },
  { id: "w8-grill-search", week: 8, kind: "practice", text: "Project Grill drill: embedding search (metrics, ANN trade-offs, similar vs substitute)" },
  { id: "w9-capstone", week: 9, kind: "build", text: "Publish capstone 1 (hierarchical probabilistic forecasting) with a clear README" },
  { id: "w10-copilot", week: 10, kind: "build", text: "Ship the DIY Project Copilot capstone with an eval suite" },
  { id: "w11-sd1", week: 11, kind: "practice", text: "Mock system design: forecasting for 10,000 stores" },
  { id: "w12-sd2", week: 12, kind: "practice", text: "Mock system design: product search or an MMM platform" },
  { id: "w13-loops", week: 13, kind: "career", text: "Schedule loops so that offers land in the same two-week window" },
  { id: "w14-negotiate", week: 14, kind: "career", text: "Prepare negotiation: total compensation table, walk-away number, competing offers" },
  { id: "w16-decide", week: 16, kind: "career", text: "Decide, accept, and write a first-90-days plan for the new role" },
];

export type Milestone = { id: string; month: number; text: string };

export const marathon: Milestone[] = [
  { id: "m4-offer", month: 4, text: "Offer in hand for a Senior DS / Applied Scientist role (the 50 LPA sprint target)" },
  { id: "m6-capstones", month: 6, text: "Two public capstones with write-ups that a hiring manager can skim in five minutes" },
  { id: "m9-own", month: 9, text: "Own a model end to end in the new role: data, training, serving, monitoring" },
  { id: "m12-writeup", month: 12, text: "Publish two technical write-ups or talks on retail ML (forecasting, MMM, search or agents)" },
  { id: "m15-lead", month: 15, text: "Lead a cross-team ML system (e.g., forecasting platform or search relevance)" },
  { id: "m18-scope", month: 18, text: "Staff-level scope: a roadmap you wrote, adopted by more than one team" },
  { id: "m24-next", month: 24, text: "Next move at the 1 Cr target, backed by shipped systems and public work" },
];

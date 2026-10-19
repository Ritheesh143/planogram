// Floor Check: diagnostic questions. Every wrong option names the misconception it
// reveals, and every misconception points to the lesson that fixes it.

export type Misconception = { id: string; name: string; explain: string; lesson: string };

export type CheckOption = { id: string; text: string; correct?: boolean; misconception?: string };

export type CheckQuestion = {
  id: string;
  topic: string;
  prompt: string;
  options: CheckOption[];
  explain: string;
  lesson: string;
};

export const misconceptions: Misconception[] = [
  { id: "inverse-conditional", name: "Flipping the conditional", explain: "Treating P(flag | fraud) as if it were P(fraud | flag). They share a numerator but restrict to different subgroups.", lesson: "counting-worlds" },
  { id: "base-rate-neglect", name: "Ignoring the base rate", explain: "When the event is rare, false alarms from the large group swamp the true hits. The base rate has to enter the answer.", lesson: "counting-worlds" },
  { id: "wrong-denominator", name: "Dividing by the wrong group", explain: "A conditional probability divides by the size of the subgroup you're restricting to, not by everyone.", lesson: "counting-worlds" },
  { id: "ci-as-posterior", name: "Reading a CI as a probability about the parameter", explain: "In the frequentist framework the true value is fixed. The 95% describes how often the interval-building recipe catches it.", lesson: "ci-repeat" },
  { id: "ci-as-spread", name: "Confusing a CI with the spread of the data", explain: "A CI is about the average (a parameter), not about individual stores. The spread of stores is much wider.", lesson: "ci-repeat" },
  { id: "ci-never-misses", name: "Expecting intervals never to miss", explain: "At 95% confidence, about 1 in 20 intervals misses the truth, through no fault of the analyst.", lesson: "ci-repeat" },
  { id: "linear-n", name: "Thinking precision grows with n, not √n", explain: "Standard error falls like 1/√n, so 4× the data gives ½ the width.", lesson: "ci-repeat" },
  { id: "likelihood-as-probability", name: "Reading likelihood as the probability of the parameter", explain: "Likelihood says how probable the observed data are under each parameter. It is not a probability distribution over the parameter.", lesson: "likelihood-dial" },
  { id: "likelihood-as-error", name: "Equating likelihood with low error", explain: "Likelihood is a probability of the data under a model. It matches a loss only for a specific noise assumption (e.g. Gaussian ↔ MSE).", lesson: "likelihood-dial" },
  { id: "mle-not-mean", name: "Not knowing where the MLE sits", explain: "For a Poisson rate, setting the derivative of the log-likelihood to zero gives the sample mean.", lesson: "likelihood-dial" },
  { id: "boosting-as-bagging", name: "Confusing boosting with bagging", explain: "Bagging trains each tree on the original target and averages them. Boosting trains each tree on what's still wrong.", lesson: "boosting-by-hand" },
  { id: "boosting-as-adaboost", name: "Confusing gradient boosting with AdaBoost", explain: "AdaBoost re-weights rows. Gradient boosting changes the target each tree learns (residuals / negative gradients).", lesson: "boosting-by-hand" },
  { id: "forgets-learning-rate", name: "Forgetting the learning rate", explain: "Each tree's output is scaled by the learning rate before it's added.", lesson: "boosting-by-hand" },
  { id: "tree-extrapolates", name: "Expecting a tree to extend a trend", explain: "Each leaf predicts an average of training targets, so beyond the training range a tree's prediction is flat.", lesson: "decision-tree" },
  { id: "tree-needs-scaling", name: "Thinking trees need scaled features", explain: "A split only compares x with a threshold, so rescaling a feature leaves the tree unchanged.", lesson: "decision-tree" },
  { id: "loss-unrelated-to-noise", name: "Treating the loss function as arbitrary", explain: "Each common loss is the negative log-likelihood of a noise model: squared error for Gaussian noise, absolute error for Laplace noise, cross-entropy for yes/no outcomes.", lesson: "mle-peak" },
  { id: "loss-mean-median", name: "Mixing up what each loss estimates", explain: "Squared error is minimized by the mean, absolute error by the median, and pinball loss by a quantile.", lesson: "mle-peak" },
  { id: "unsure", name: "Not sure yet", explain: "An honest 'not sure' is useful: it tells you exactly where to start.", lesson: "counting-worlds" },
];

export const checkQuestions: CheckQuestion[] = [
  {
    id: "fraud-base-rate",
    topic: "Bayes",
    prompt: "1% of returns are fraudulent. A fraud flag catches 90% of fraudulent returns and wrongly flags 5% of genuine ones. A return gets flagged. Roughly how likely is it to be fraud?",
    options: [
      { id: "a", text: "About 90%", misconception: "inverse-conditional" },
      { id: "b", text: "About 50%", misconception: "base-rate-neglect" },
      { id: "c", text: "About 15%", correct: true },
      { id: "d", text: "About 5%", misconception: "base-rate-neglect" },
      { id: "e", text: "Not sure", misconception: "unsure" },
    ],
    explain: "Out of 1,000 returns: 10 fraud → 9 flagged; 990 genuine → about 50 flagged. 9 of 59 flagged ≈ 15%.",
    lesson: "counting-worlds",
  },
  {
    id: "paint-brush",
    topic: "Conditional probability",
    prompt: "Out of 1,000 shoppers, 200 buy paint. 50 of those paint buyers also buy brushes. Pick a random paint buyer: what's the chance they bought a brush?",
    options: [
      { id: "a", text: "5%", misconception: "wrong-denominator" },
      { id: "b", text: "25%", correct: true },
      { id: "c", text: "20%", misconception: "wrong-denominator" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "Restrict to paint buyers (200) and count brush buyers inside: 50 / 200 = 25%.",
    lesson: "counting-worlds",
  },
  {
    id: "fraud-prevalence",
    topic: "Bayes",
    prompt: "The same flag (90% sensitivity, 5% false alarms) is moved to a store where fraud is 10% of returns. Of flagged returns there, roughly what share are fraud?",
    options: [
      { id: "a", text: "Still about 15%: the model didn't change", misconception: "base-rate-neglect" },
      { id: "b", text: "About 67%", correct: true },
      { id: "c", text: "About 90%", misconception: "inverse-conditional" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "Out of 1,000: 100 fraud → 90 flagged; 900 genuine → 45 flagged. 90 / 135 ≈ 67%. Precision depends on prevalence.",
    lesson: "counting-worlds",
  },
  {
    id: "ci-meaning",
    topic: "Confidence intervals",
    prompt: "An A/B test reports the endcap's lift with a 95% confidence interval of [2%, 8%]. Which statement is correct?",
    options: [
      { id: "a", text: "There's a 95% probability the true lift is between 2% and 8%", misconception: "ci-as-posterior" },
      { id: "b", text: "If we repeated the experiment many times, about 95% of intervals built this way would contain the true lift", correct: true },
      { id: "c", text: "95% of stores saw a lift between 2% and 8%", misconception: "ci-as-spread" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "The true lift is fixed. The 95% belongs to the procedure: it catches the truth in about 95% of repeated experiments.",
    lesson: "ci-repeat",
  },
  {
    id: "ci-misses",
    topic: "Confidence intervals",
    prompt: "Your team reports 200 independent experiments a year, each with a 95% CI. About how many of those intervals miss the true effect?",
    options: [
      { id: "a", text: "None, if the analysis is done correctly", misconception: "ci-never-misses" },
      { id: "b", text: "About 10", correct: true },
      { id: "c", text: "About 95", misconception: "ci-as-posterior" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "5% of 200 = 10, give or take about 3. You can't tell which ones.",
    lesson: "ci-repeat",
  },
  {
    id: "ci-width",
    topic: "Confidence intervals",
    prompt: "With 20 stores the CI is 8 points wide. With 80 stores (and similar stores) it will be about…",
    options: [
      { id: "a", text: "2 points wide", misconception: "linear-n" },
      { id: "b", text: "4 points wide", correct: true },
      { id: "c", text: "8 points wide, because the stores are similar", misconception: "ci-as-spread" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "Width ∝ 1/√n. 4× the stores → ½ the width.",
    lesson: "ci-repeat",
  },
  {
    id: "likelihood-meaning",
    topic: "Likelihood",
    prompt: "A store sold 0, 2 and 1 drills on three days. 'Under a Poisson model, λ = 1 has a higher likelihood than λ = 5.' What does this mean?",
    options: [
      { id: "a", text: "There's a higher probability that the true rate is 1 than 5", misconception: "likelihood-as-probability" },
      { id: "b", text: "Seeing 0, 2, 1 is more probable if the rate were 1 than if it were 5", correct: true },
      { id: "c", text: "Predicting 1 per day gives a smaller squared error than predicting 5", misconception: "likelihood-as-error" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "Likelihood fixes the data and asks how probable it is under each parameter. Here the data are about 1,300× more probable under λ = 1.",
    lesson: "likelihood-dial",
  },
  {
    id: "mle-poisson",
    topic: "Likelihood",
    prompt: "Same data (0, 2, 1). Which λ maximizes the Poisson likelihood?",
    options: [
      { id: "a", text: "0", misconception: "mle-not-mean" },
      { id: "b", text: "1", correct: true },
      { id: "c", text: "2, the most common large value", misconception: "mle-not-mean" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "d/dλ of the log-likelihood is Σk/λ − n = 0, so λ̂ = mean = 1.",
    lesson: "likelihood-dial",
  },
  {
    id: "boosting-target",
    topic: "Boosting",
    prompt: "In gradient boosting with squared-error loss, what does each new tree try to predict?",
    options: [
      { id: "a", text: "The original target y, and the trees are averaged", misconception: "boosting-as-bagging" },
      { id: "b", text: "The current residuals (y − current prediction)", correct: true },
      { id: "c", text: "The same target, with misclassified rows up-weighted", misconception: "boosting-as-adaboost" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "Each tree fits the residuals, which are the negative gradient of squared error with respect to the prediction.",
    lesson: "boosting-by-hand",
  },
  {
    id: "boosting-update",
    topic: "Boosting",
    prompt: "A store's current prediction is 100. The learning rate is 0.1 and the new tree outputs 20 for it. What's the new prediction?",
    options: [
      { id: "a", text: "120", misconception: "forgets-learning-rate" },
      { id: "b", text: "102", correct: true },
      { id: "c", text: "20", misconception: "boosting-as-bagging" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "New prediction = old + learning rate × tree output = 100 + 0.1 × 20 = 102.",
    lesson: "boosting-by-hand",
  },
  {
    id: "tree-extrapolation",
    topic: "Model Lab",
    prompt: "A depth-6 regression tree is trained on stores of 10k–40k sq ft. What does it predict for a new 80k sq ft store?",
    options: [
      { id: "a", text: "Roughly double a 40k store, following the trend", misconception: "tree-extrapolates" },
      { id: "b", text: "The same as the largest stores it was trained on", correct: true },
      { id: "c", text: "It depends on whether the area feature was standardized", misconception: "tree-needs-scaling" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "The 80k store falls in the same leaf as the biggest training stores, and a leaf predicts their average. Trees can't extrapolate.",
    lesson: "decision-tree",
  },
  {
    id: "loss-noise",
    topic: "Likelihood ↔ Loss",
    prompt: "Daily sales of a slow-moving SKU are skewed: most days 0–2 units, some days 15. You fit a constant with absolute error instead of squared error. What does the fitted constant estimate?",
    options: [
      { id: "a", text: "The mean, like any reasonable loss", misconception: "loss-mean-median" },
      { id: "b", text: "The median", correct: true },
      { id: "c", text: "Nothing in particular: a loss is just a way to score errors", misconception: "loss-unrelated-to-noise" },
      { id: "d", text: "Not sure", misconception: "unsure" },
    ],
    explain: "Absolute error is minimized by the median (it's the Laplace negative log-likelihood). Squared error gives the mean, and Poisson deviance gives the rate.",
    lesson: "mle-peak",
  },
];

// Flashcards for spaced repetition, keyed by lesson. Card ids must stay stable
// once published, because review history is stored against them.

export type Flashcard = { id: string; lesson: string; front: string; back: string };

export const cards: Flashcard[] = [
  // K1 Counting Worlds
  { id: "cw-1", lesson: "counting-worlds", front: "1% of returns are fraud. The flag catches 90% of fraud and wrongly flags 5% of genuine returns. A return is flagged. Roughly how likely is fraud? Show the counts.", back: "About 15%. Out of 1,000 returns: 10 fraud → 9 flagged; 990 genuine → about 50 flagged. 9 of 59 flagged returns are fraud ≈ 15%." },
  { id: "cw-2", lesson: "counting-worlds", front: "What is base-rate neglect?", back: "Judging P(fraud | flagged) by the flag's accuracy alone and ignoring how rare fraud is. When the base rate is low, false alarms from the huge genuine group swamp the true hits." },
  { id: "cw-3", lesson: "counting-worlds", front: "Write Bayes' theorem as a counting rule.", back: "P(A | B) = (count of worlds with A and B) / (count of worlds with B). The formula P(B|A)P(A)/P(B) is the same ratio with every count divided by the total." },
  { id: "cw-4", lesson: "counting-worlds", front: "P(flag | fraud) vs P(fraud | flag): which one is the model's sensitivity, and which one does the store manager care about?", back: "P(flag | fraud) is sensitivity (a property of the model). P(fraud | flag) is the precision the manager experiences, and it depends on the base rate." },
  { id: "cw-5", lesson: "counting-worlds", front: "Fraud rises from 1% to 10%, with the model unchanged. What happens to P(fraud | flag)?", back: "It jumps from about 15% to about 67%: 90 caught vs 45 false alarms out of 1,000. Precision depends on prevalence." },

  // K2 CI repeat
  { id: "ci-1", lesson: "ci-repeat", front: "What does a 95% confidence interval promise?", back: "If you repeated the whole experiment many times and built an interval the same way each time, about 95% of those intervals would contain the true value. The 95% belongs to the procedure." },
  { id: "ci-2", lesson: "ci-repeat", front: "Is it correct to say \"there is a 95% probability the true lift is in [2%, 8%]\"?", back: "Not in the frequentist framework. The true lift is fixed, so this one interval either contains it or not. That sentence describes a Bayesian credible interval, which needs a prior." },
  { id: "ci-3", lesson: "ci-repeat", front: "You run 200 independent experiments with 95% CIs. How many intervals should miss the truth?", back: "About 10 (5% of 200), give or take about 3 from chance alone." },
  { id: "ci-4", lesson: "ci-repeat", front: "How does the CI width change when you quadruple the number of stores?", back: "It halves. Width ∝ 1/√n, so 4× the stores gives 1/2 the width." },
  { id: "ci-5", lesson: "ci-repeat", front: "Formula for an approximate 95% CI for a difference in means between test and control stores.", back: "(x̄_T − x̄_C) ± 1.96 · √(s_T²/n_T + s_C²/n_C)" },

  // K3 Likelihood dial
  { id: "ld-1", lesson: "likelihood-dial", front: "Probability vs likelihood in one sentence each.", back: "Probability: the parameter is fixed and we ask how probable different data are. Likelihood: the data is fixed and we ask how well different parameter values explain it." },
  { id: "ld-2", lesson: "likelihood-dial", front: "Sales of 0, 2, 1 drills under a Poisson model. What λ maximizes the likelihood?", back: "λ = 1, the sample mean (0 + 2 + 1) / 3. For Poisson the MLE is always the average." },
  { id: "ld-3", lesson: "likelihood-dial", front: "Why do we maximize the log-likelihood instead of the likelihood?", back: "The log turns a product of many small probabilities into a sum. That is easier to differentiate, avoids numerical underflow, and has the same peak because log is increasing." },
  { id: "ld-4", lesson: "likelihood-dial", front: "Does a likelihood curve over λ integrate to 1?", back: "No. It is not a probability distribution over λ. Turning it into one needs a prior and normalization, which is Bayes." },
  { id: "ld-5", lesson: "likelihood-dial", front: "Which loss do you get from the negative log-likelihood of a Gaussian with fixed variance?", back: "Mean squared error, up to constants. Minimizing MSE is maximum likelihood under Gaussian noise." },

  // K4 Boosting by hand
  { id: "bh-1", lesson: "boosting-by-hand", front: "In gradient boosting with squared error, what does each new tree predict?", back: "The current residuals y − ŷ, which are the negative gradient of ½(y − ŷ)² with respect to ŷ." },
  { id: "bh-2", lesson: "boosting-by-hand", front: "Current prediction 100, learning rate 0.1, the new tree outputs 20 for this row. New prediction?", back: "100 + 0.1 × 20 = 102." },
  { id: "bh-3", lesson: "boosting-by-hand", front: "What does the first 'tree' (round 0) of a squared-error GBM predict?", back: "A constant: the mean of y, which is the value that minimizes squared error." },
  { id: "bh-4", lesson: "boosting-by-hand", front: "Boosting vs bagging (random forest) in one line.", back: "Bagging averages many independent deep trees to reduce variance. Boosting adds many small trees in sequence, each correcting the last, to reduce bias." },
  { id: "bh-5", lesson: "boosting-by-hand", front: "What is a pseudo-residual?", back: "The negative gradient of any loss with respect to the current prediction. For MSE it equals the plain residual. For other losses (quantile, Tweedie) it is what the next tree fits." },
  { id: "bh-6", lesson: "boosting-by-hand", front: "Why use a small learning rate in boosting?", back: "Each tree only takes a small step, so mistakes from one noisy tree are diluted. More trees are needed, but the model generalizes better (shrinkage)." },

  // Model Lab: linear regression
  { id: "lr-1", lesson: "linear-regression", front: "One-feature OLS slope, in words and symbols.", back: "Covariance over variance: b = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)². It comes from setting dSSE/db = 0." },
  { id: "lr-2", lesson: "linear-regression", front: "What do the normal equations XᵀXβ = Xᵀy say geometrically?", back: "The residual y − Xβ is perpendicular to every column of X, so Xβ is the projection of y onto the space the columns span." },
  { id: "lr-3", lesson: "linear-regression", front: "Why is minimizing squared error the 'right' choice under Gaussian noise?", back: "The Gaussian log-likelihood is a constant minus SSE / (2σ²), so the MLE and the least-squares line are the same." },
  { id: "lr-4", lesson: "linear-regression", front: "Ridge as a Bayesian estimate: which prior, and what is λ?", back: "A Gaussian prior β ~ N(0, τ²). Ridge is the posterior mode (MAP) with λ = σ² / τ²." },
  { id: "lr-5", lesson: "linear-regression", front: "Why does lasso zero out coefficients but ridge doesn't?", back: "The L1 ball is a diamond with corners on the axes; the error ellipse usually first touches it at a corner, where a coefficient is exactly 0. The L2 ball is round, with no corners." },
  { id: "lr-6", lesson: "linear-regression", front: "What does multicollinearity damage, and what does it leave alone?", back: "It inflates the variance of individual coefficients (VIF = 1/(1 − R²ⱼ)), so they swing between refits. Predictions within the data's range, and sums of the collinear coefficients, stay stable." },

  // Model Lab: decision tree
  { id: "dt-1", lesson: "decision-tree", front: "How does a regression tree score a candidate split?", back: "Gain = SSE(parent) − SSE(left) − SSE(right), where each SSE is measured around that node's own mean. Keep the split with the largest gain." },
  { id: "dt-2", lesson: "decision-tree", front: "Gini impurity of a node with class share p (binary).", back: "1 − p² − (1 − p)² = 2p(1 − p): the chance two random rows from the node disagree. 0 when pure, 0.5 at 50/50." },
  { id: "dt-3", lesson: "decision-tree", front: "Why is misclassification rate a poor splitting criterion?", back: "It is linear in p, so splits that create pure children can score the same as splits that don't. Concave impurities (Gini, entropy) reward purity." },
  { id: "dt-4", lesson: "decision-tree", front: "Cost-complexity pruning objective.", back: "Minimize total leaf impurity + α × number of leaves. A split survives only if its gain exceeds α." },
  { id: "dt-5", lesson: "decision-tree", front: "Why can't a tree extrapolate a trend?", back: "Every leaf predicts an average of training targets, so beyond the last split point the prediction is a constant." },
  { id: "dt-6", lesson: "decision-tree", front: "Why do trees not need feature scaling?", back: "A split only asks whether x < t, so any increasing transform of a feature keeps the same ordering and the same tree." },

  // Bayes rung 2: MLE and losses
  { id: "ml-1", lesson: "mle-peak", front: "Squared error is the negative log-likelihood of which noise model? What does it estimate?", back: "Gaussian noise with fixed variance. Its best constant is the mean." },
  { id: "ml-2", lesson: "mle-peak", front: "Absolute error is the negative log-likelihood of which noise model? What does it estimate?", back: "Laplace noise. Its best constant is the median, because the signs of the residuals must balance." },
  { id: "ml-3", lesson: "mle-peak", front: "Write binary cross-entropy and say what it is.", back: "−[y log p + (1 − y) log(1 − p)]: the negative log-likelihood of a Bernoulli outcome. Minimizing it is maximum likelihood for p." },
  { id: "ml-4", lesson: "mle-peak", front: "Which loss gives a 90th-percentile forecast?", back: "Pinball (quantile) loss with τ = 0.9: under-predictions cost 0.9 per unit, over-predictions 0.1." },
  { id: "ml-5", lesson: "mle-peak", front: "Why is Tweedie a common objective for daily SKU sales?", back: "It's a Poisson number of gamma-sized purchases: a point mass at zero plus a continuous spread, with a log link that keeps forecasts positive." },
  { id: "ml-6", lesson: "mle-peak", front: "You report WAPE. Which point forecast minimizes it, and why does that matter for slow movers?", back: "The median (WAPE is scaled absolute error). On intermittent SKUs the median can be 0, so a WAPE-optimal model may forecast zero." },
];

export function cardsForLesson(slug: string): Flashcard[] {
  return cards.filter((c) => c.lesson === slug);
}

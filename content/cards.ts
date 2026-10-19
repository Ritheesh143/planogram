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
];

export function cardsForLesson(slug: string): Flashcard[] {
  return cards.filter((c) => c.lesson === slug);
}

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

  // Math Toolkit: integrals
  { id: "it-1", lesson: "integrals-thin-bars", front: "What is an integral, in bars?", back: "Σ height × width over many thin bars, with the bars made so thin that the sum stops changing." },
  { id: "it-2", lesson: "integrals-thin-bars", front: "Four bars under f(x) = 2x on [0, 1]: left, right and middle sums?", back: "0.75, 1.25 and 1.00. The true area is 1; the middle rule is exact for a straight line." },
  { id: "it-3", lesson: "integrals-thin-bars", front: "Three integrals of a probability density p(x).", back: "Total area ∫p = 1; P(X ≤ c) = area left of c; mean = ∫x·p(x)dx = Σ x × height × width." },
  { id: "it-4", lesson: "integrals-thin-bars", front: "Can a density exceed 1?", back: "Yes. Beta(5, 15) peaks near 4.2. Only areas under a density are probabilities." },
  { id: "it-5", lesson: "integrals-thin-bars", front: "Why does Bayesian modelling use sampling rather than bars?", back: "Bars need nᵈ boxes in d dimensions; Monte Carlo error shrinks like 1/√n whatever the dimension." },

  // Math Toolkit: vectors
  { id: "vb-1", lesson: "vectors-baskets", front: "Dot product of baskets (2,1,1,0,0) and (1,1,0,0,0)?", back: "2·1 + 1·1 + 0 + 0 + 0 = 3: multiply matching positions and add. It's non-zero only where both baskets have something." },
  { id: "vb-2", lesson: "vectors-baskets", front: "Cosine similarity: formula and meaning.", back: "a·b / (‖a‖‖b‖): the cosine of the angle between the baskets. 1 means the same mix, 0 nothing in common; it ignores basket size." },
  { id: "vb-3", lesson: "vectors-baskets", front: "Why did ranking shoppers by raw dot product return only contractors?", back: "The dot product grows with basket size × similarity, so the biggest baskets win. Cosine removes size and ranks by mix." },
  { id: "vb-4", lesson: "vectors-baskets", front: "How are Euclidean distance and cosine related for length-1 vectors?", back: "‖a − b‖² = 2 − 2cos θ, so ranking by smallest distance equals ranking by largest cosine." },
  { id: "vb-5", lesson: "vectors-baskets", front: "How is a linear model's prediction a dot product?", back: "Prediction = feature row · coefficients, like a basket's value = basket · prices." },

  // Math Toolkit: matrices
  { id: "mt-1", lesson: "matrices-tables", front: "What does a matrix times a vector do to a stores × SKUs units table and a price list?", back: "It dots every store's row with the prices, giving every store's revenue at once." },
  { id: "mt-2", lesson: "matrices-tables", front: "Shape rule for AB.", back: "(m × n)(n × k) = m × k. The inner sizes must match, and in general AB ≠ BA." },
  { id: "mt-3", lesson: "matrices-tables", front: "What is XᵀX?", back: "Every pair of columns of X dotted together, with sums of squares on the diagonal. It's symmetric." },
  { id: "mt-4", lesson: "matrices-tables", front: "Why does an exactly duplicated column break linear regression?", back: "XᵀX has a zero determinant, so the normal equations have infinitely many solutions. Ridge adds λ to the diagonal to fix it." },
  { id: "mt-5", lesson: "matrices-tables", front: "Average of revenues over price scenarios vs revenue at average prices?", back: "Equal, because a matrix product is linear. They stop being equal once demand responds to price." },

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

  // Model Lab: gradient boosting
  { id: "gb-1", lesson: "gradient-boosting", front: "For a general loss, what does each boosting tree fit, and how are its leaf values set?", back: "It fits the pseudo-residuals −∂L/∂F. Each leaf then gets the best constant step for that loss: mean (squared), median (absolute), quantile (pinball) or Newton step −G/(H + λ)." },
  { id: "gb-2", lesson: "gradient-boosting", front: "Pseudo-residual for absolute-error loss, and why it makes boosting robust.", back: "sign(y − F): ±1. A huge outlier pulls exactly as hard as a small miss." },
  { id: "gb-3", lesson: "gradient-boosting", front: "XGBoost leaf value and split gain.", back: "w* = −G/(H + λ). Gain = ½[G_L²/(H_L + λ) + G_R²/(H_R + λ) − (G_L + G_R)²/(H_L + H_R + λ)] − γ." },
  { id: "gb-4", lesson: "gradient-boosting", front: "Gradient and hessian of log loss with respect to the raw score.", back: "g = p − y, h = p(1 − p)." },
  { id: "gb-5", lesson: "gradient-boosting", front: "Why does a Poisson boosting step multiply predictions instead of adding to them?", back: "The raw score is log(rate), so adding ηw to it multiplies the rate by e^(ηw)." },
  { id: "gb-6", lesson: "gradient-boosting", front: "λ vs γ in XGBoost.", back: "λ shrinks every leaf value toward 0 (L2). γ is a minimum gain a split must exceed, so it prunes whole splits." },

  // Model Lab: XGBoost vs LightGBM vs CatBoost
  { id: "xl-1", lesson: "xgb-lgbm-catboost", front: "Level-wise vs leaf-wise tree growth.", back: "Level-wise (XGBoost default) splits every node at a depth before going deeper. Leaf-wise (LightGBM) always splits the leaf with the largest gain, giving deeper, lopsided trees that fit faster and can overfit small data." },
  { id: "xl-2", lesson: "xgb-lgbm-catboost", front: "What does GOSS do, and why is it unbiased?", back: "Keeps the top a share of rows by |gradient|, samples b of the rest and up-weights them by (1 − a)/b, so the expected gradient sums are unchanged." },
  { id: "xl-3", lesson: "xgb-lgbm-catboost", front: "Why does naive target encoding leak?", back: "Each row's encoding includes its own target. For rare categories the encoding nearly equals the label, so the feature looks predictive only in training." },
  { id: "xl-4", lesson: "xgb-lgbm-catboost", front: "CatBoost's ordered target statistic for a row.", back: "In a random order, (sum of earlier same-category targets + a·prior) / (earlier count + a). A row never sees its own target." },
  { id: "xl-5", lesson: "xgb-lgbm-catboost", front: "How do XGBoost and LightGBM handle missing values?", back: "At each split they try sending missing rows left and right and keep the direction with the higher gain (a learned default direction)." },
  { id: "xl-6", lesson: "xgb-lgbm-catboost", front: "Main tree-size knob in LightGBM vs XGBoost.", back: "LightGBM: num_leaves (keep below 2^max_depth). XGBoost: max_depth." },

  // Model Lab: MLP
  { id: "mp-1", lesson: "mlp", front: "What is a single ReLU neuron, in terms of models you know?", back: "A linear regression w·x + b followed by a bend: zero on one side of the line w·x + b = 0, linear on the other." },
  { id: "mp-2", lesson: "mlp", front: "Where does the unit ReLU(wx + b) bend?", back: "At x = −b/w. Each hidden unit adds one kink to a one-input network." },
  { id: "mp-3", lesson: "mlp", front: "Backprop for an output weight v₁ in ŷ = v₁h₁ + v₂h₂ + c with loss ½(ŷ − y)².", back: "∂L/∂v₁ = (ŷ − y)·h₁. Error signal times the input that weight multiplied." },
  { id: "mp-4", lesson: "mlp", front: "What does ReLU do to the gradient in the backward pass?", back: "Passes it unchanged where the unit was on (z > 0) and blocks it (0) where it was off. A unit off for every row never learns: a dead ReLU." },
  { id: "mp-5", lesson: "mlp", front: "Why must MLP inputs be standardized?", back: "Gradients scale with input size, so one learning rate can't suit a price in rupees and a bias; He initialization also assumes unit-variance inputs." },
  { id: "mp-6", lesson: "mlp", front: "How does a ReLU MLP extrapolate beyond the training range?", back: "Linearly: past the last kink every unit is permanently on or off, so the output is a fixed straight line." },

  // Tree vs MLP
  { id: "tm-1", lesson: "tree-vs-mlp", front: "Shape of a tree's prediction vs a ReLU MLP's.", back: "Tree: constant within axis-aligned boxes. ReLU MLP: linear within regions bounded by hyperplanes at any angle." },
  { id: "tm-2", lesson: "tree-vs-mlp", front: "Which model suits thresholds and jumps, and which suits smooth diagonal effects?", back: "Thresholds and jumps: trees. Smooth, oblique effects: MLPs." },
  { id: "tm-3", lesson: "tree-vs-mlp", front: "Three reasons tree ensembles beat MLPs on typical tabular data (Grinsztajn et al., 2022).", back: "Irregular targets (MLPs over-smooth), uninformative features (MLPs mix them in), and meaningful feature axes (MLPs are rotation-invariant)." },
  { id: "tm-4", lesson: "tree-vs-mlp", front: "Does boosting fix trees' inability to extrapolate?", back: "No. A sum of piecewise-constant trees is still piecewise constant and flat beyond the data. Fix it by detrending the target or using linear leaves." },

  // Model Arena
  { id: "ar-1", lesson: "model-arena", front: "WAPE: definition, and which point forecast minimizes it.", back: "Σ|y − ŷ| / Σy. It's an absolute-error score, so the median minimizes it, which under-forecasts right-skewed demand." },
  { id: "ar-2", lesson: "model-arena", front: "Why report bias next to WAPE?", back: "WAPE ignores direction. Two forecasts can tie on WAPE while one under-forecasts by 20%, which is a stockout plan." },
  { id: "ar-3", lesson: "model-arena", front: "In the Arena, how did tree models do on stores bigger than any in training?", back: "All under-forecast by about 7–11%: store size beyond the training range falls in edge leaves. The MLP and a log-feature Poisson GLM extrapolated." },
  { id: "ar-4", lesson: "model-arena", front: "Why did scikit-learn's classic trees collapse when given only store and SKU IDs?", back: "They received the IDs as arbitrary integer codes. Libraries with native categorical handling (LightGBM, CatBoost, HistGB, XGBoost) stayed near the top." },
  { id: "ar-5", lesson: "model-arena", front: "Three rules for a fair model benchmark.", back: "One time-based split for everyone; the same features and a stated tuning budget; report bias and cost alongside error, on the stress scenarios your business will face." },

  // Bayes rung 3: a grid of hypotheses
  { id: "pg-1", lesson: "posterior-grid", front: "What is 'a parameter as a distribution', concretely?", back: "A list of possible values (the worlds) with how much you believe each one. The weights add up to 1." },
  { id: "pg-2", lesson: "posterior-grid", front: "The grid recipe for a posterior.", back: "Prior weight × likelihood for each candidate value, then divide by the total of those products." },
  { id: "pg-3", lesson: "posterior-grid", front: "Sales 0, 2, 1 and a flat prior over λ = 0.5, 1, 2, 4. Posterior?", back: "About 0.285, 0.509, 0.203, 0.004 (mean ≈ 1.07). Almost no belief left in λ = 4." },
  { id: "pg-4", lesson: "posterior-grid", front: "Does updating day by day give a different answer from updating on all the days at once?", back: "No. Yesterday's posterior is today's prior; independent days multiply, so order and grouping don't matter." },
  { id: "pg-5", lesson: "posterior-grid", front: "When is a 90% credible interval right 90% of the time?", back: "When the prior honestly describes how the parameter varies across the worlds you face. A confident wrong prior can be badly miscalibrated." },
  { id: "pg-6", lesson: "posterior-grid", front: "Why don't real Bayesian models use grids?", back: "Grid size grows exponentially with the number of parameters (60 points each → 60^k). Samplers like MCMC are used instead." },

  // Bayes rung 4: Beta–Binomial
  { id: "bb-1", lesson: "beta-binomial", front: "Beta(a, b) prior + k successes in n trials gives…", back: "Beta(a + k, b + n − k). Updating is adding counts." },
  { id: "bb-2", lesson: "beta-binomial", front: "How do you read the numbers a and b in a Beta prior?", back: "Pseudo-counts: a pretend successes and b pretend failures. Mean a/(a + b); a + b is how many observations the prior is worth." },
  { id: "bb-3", lesson: "beta-binomial", front: "Prior Beta(2, 8), 3 of 10 shoppers buy. Posterior, mean, 90% interval?", back: "Beta(5, 15), mean 0.25, 90% interval about 0.110 to 0.419." },
  { id: "bb-4", lesson: "beta-binomial", front: "Posterior mean of a Beta–Binomial as a weighted average.", back: "(a + k)/(a + b + n) = [(a + b)/(a + b + n)]·prior mean + [n/(a + b + n)]·k/n." },
  { id: "bb-5", lesson: "beta-binomial", front: "Why rank low-traffic products by posterior mean, not raw rate?", back: "Raw rates from tiny samples swing to 0% or 100%. The posterior mean shrinks them toward the typical rate, so flukes don't top the list." },
  { id: "bb-6", lesson: "beta-binomial", front: "What is a conjugate prior?", back: "One whose posterior is in the same family as the prior (Beta–Binomial, Gamma–Poisson, Normal–Normal). A convenience, not a requirement." },

  // Bayes rung 5: gamma-Poisson
  { id: "gp-1", lesson: "gamma-poisson", front: "Gamma(α, β) prior on a daily sales rate: what do α and β mean?", back: "Fake history: α pseudo-sales over β pseudo-days. The prior mean is α/β." },
  { id: "gp-2", lesson: "gamma-poisson", front: "Gamma(α, β) prior + n days selling S units in total → posterior?", back: "Gamma(α + S, β + n): add sales to sales, days to days." },
  { id: "gp-3", lesson: "gamma-poisson", front: "Write the gamma-Poisson posterior mean as a weighted average.", back: "(α + S)/(β + n) = β/(β + n) · α/β + n/(β + n) · sample mean. The prior's weight is its pseudo-days' share." },
  { id: "gp-4", lesson: "gamma-poisson", front: "What is the posterior predictive for tomorrow's sales in a gamma-Poisson model?", back: "Negative binomial: the Poisson averaged over the gamma belief. P(0) = (β/(β + 1))^α." },
  { id: "gp-5", lesson: "gamma-poisson", front: "Why is the predictive wider than a Poisson at the posterior mean?", back: "Var = E[λ] + Var(λ): Poisson luck plus not knowing λ. For Gamma(5, 4): 1.25 + 0.3125 = 1.5625." },
  { id: "gp-6", lesson: "gamma-poisson", front: "Stores whose rates follow Gamma(k, k/μ): variance of pooled daily sales?", back: "μ + μ²/k, so variance ÷ mean = 1 + μ/k. Smaller k means more over-dispersion." },

  // Bayes rung 6: priors you can defend
  { id: "pd-1", lesson: "priors-defend", front: "What is a prior predictive check?", back: "Simulate parameters from the prior, then data from the likelihood, and ask whether the implied data look plausible." },
  { id: "pd-2", lesson: "priors-defend", front: "log λ ~ Normal(0, 10) for daily drill sales: what does it imply?", back: "Median 1 a day, but a 95th percentile near 14 million and about 1 store in 4 above 1,000 a day. Not 'uninformative'." },
  { id: "pd-3", lesson: "priors-defend", front: "Turn last year's lift test (6%, 95% CI [2%, 10%]) into a prior.", back: "Normal(6, 2²): the CI's half-width of 4 is about 2 standard errors." },
  { id: "pd-4", lesson: "priors-defend", front: "Combine a Normal(6, 4) prior with a new estimate 12 ± 4 (variance 16).", back: "Weights by precision: 0.25 and 0.0625 → 0.8 and 0.2. Posterior 7.2, variance 3.2." },
  { id: "pd-5", lesson: "priors-defend", front: "Why do priors wash out, and when don't they?", back: "The prior is one fixed term; the log-likelihood grows with every observation. They don't wash out for parameters the data can't separate, like collinear media channels." },

  // Bayes rung 7: shrinkage
  { id: "sh-1", lesson: "shrinkage", front: "Normal prior N(μ₀, τ²), n observations with variance σ² averaging ȳ: posterior mean?", back: "w·ȳ + (1 − w)·μ₀ with w = n/(n + σ²/τ²). Precisions add: 1/v = 1/τ² + n/σ²." },
  { id: "sh-2", lesson: "shrinkage", front: "How many 'weeks of data' is a prior worth?", back: "σ²/τ²: the prior acts like that many extra observations at the prior mean. With σ = 20 and τ = 10 it's 4 weeks." },
  { id: "sh-3", lesson: "shrinkage", front: "Why do the top stores by raw average tend to be new stores?", back: "Averages over few weeks are noisy, so the extremes are dominated by luck. Ranking by shrunk estimates fixes it." },
  { id: "sh-4", lesson: "shrinkage", front: "Shrinkage is biased. Why does it still win?", back: "MSE = bias² + variance. For units with little data, shrinking removes far more variance than the bias it adds (Stein's paradox)." },
  { id: "sh-5", lesson: "shrinkage", front: "Shrinkage toward μ₀ as a penalty.", back: "Minimize n(ȳ − θ)² + (σ²/τ²)(θ − μ₀)²: ridge with λ = σ²/τ², centred on μ₀ instead of 0." },

  // Bayes rung 8: Bayesian linear regression
  { id: "bl-1", lesson: "bayes-linreg", front: "Posterior for a slope with centered x, noise σ², prior N(m₀, τ²).", back: "Precision Sxx/σ² + 1/τ²; mean (Sxy/σ² + m₀/τ²)/precision." },
  { id: "bl-2", lesson: "bayes-linreg", front: "Ridge regression in Bayesian terms.", back: "The posterior mode (MAP) under a N(0, τ²) prior on coefficients, with λ = σ²/τ²." },
  { id: "bl-3", lesson: "bayes-linreg", front: "Predictive variance at a new price x.", back: "σ² + σ²/n + (x − x̄)²·Var(slope): noise, level and slope uncertainty. The slope term grows with distance from the average price." },
  { id: "bl-4", lesson: "bayes-linreg", front: "When are 90% credible intervals right 90% of the time?", back: "When the prior matches the world. A confident wrong prior can give near-0% coverage; a flat prior matches the confidence interval." },
  { id: "bl-5", lesson: "bayes-linreg", front: "Posterior slope for the paint data with τ² = 0.4, σ² = 4.", back: "Prior and data equally precise (2.5 each): mean −4, sd 0.45. The same as ridge with λ = 10." },

  // Bayes rung 9: hierarchical pooling
  { id: "hp-1", lesson: "hierarchical-pooling", front: "No pooling, complete pooling, partial pooling.", back: "Each group alone; one estimate for all; each group shrunk toward the group mean with weight τ²/(τ² + σ²/nⱼ) on its own data." },
  { id: "hp-2", lesson: "hierarchical-pooling", front: "Method-of-moments estimate of the between-store spread τ².", back: "τ̂² = max(0, variance of store averages − average of σ²/nⱼ): observed spread minus sampling noise." },
  { id: "hp-3", lesson: "hierarchical-pooling", front: "Expected squared error of complete pooling when stores differ with sd τ.", back: "About τ²: every store gets the chain mean, which misses each store's true mean by a draw with sd τ." },
  { id: "hp-4", lesson: "hierarchical-pooling", front: "Random effects vs fixed effects for stores.", back: "Random effects = partial pooling (store intercepts drawn from a distribution, shrunk, predictable for new stores). Fixed effects = no pooling." },
  { id: "hp-5", lesson: "hierarchical-pooling", front: "Why does a hierarchical MMM beat separate regional MMMs?", back: "Regions with little data or spend variation borrow strength from the national effect instead of producing unstable ROIs; how much is learned from the data." },
];

export function cardsForLesson(slug: string): Flashcard[] {
  return cards.filter((c) => c.lesson === slug);
}

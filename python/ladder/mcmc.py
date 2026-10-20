"""Random-walk Metropolis and the two diagnostics every sampler report shows: R-hat and ESS.

The same code appears in the MCMC lesson's Build It section; pytest checks it recovers a posterior
whose answer is known exactly.
"""

from __future__ import annotations

from typing import Callable

import numpy as np


def metropolis(logp: Callable[[float], float], start: float, step: float, n: int, rng: np.random.Generator) -> tuple[np.ndarray, float]:
    """Propose x + Normal(0, step); accept with probability min(1, p(new) / p(old)).

    Only the ratio of posteriors is used, so logp may leave out the normalizing constant.
    Returns the draws and the acceptance rate.
    """
    x = start
    lp = logp(x)
    draws = np.empty(n)
    accepted = 0
    for i in range(n):
        proposal = x + rng.normal(0, step)
        lq = logp(proposal)
        if np.log(rng.uniform()) < lq - lp:
            x, lp = proposal, lq
            accepted += 1
        draws[i] = x
    return draws, accepted / n


def ess(x: np.ndarray) -> float:
    """Effective sample size: N / (1 + 2 Σ autocorrelations), summing lags in pairs until a pair goes negative."""
    x = np.asarray(x, dtype=float)
    n = len(x)
    d = x - x.mean()
    var = float(np.sum(d * d))
    if var == 0:
        return 1.0
    acf = np.correlate(d, d, mode="full")[n - 1 :] / var
    total = 0.0
    for m in range(0, (n - 1) // 2):
        pair = acf[2 * m] + acf[2 * m + 1]
        if pair <= 0:
            break
        total += pair
    return n / max(-1 + 2 * total, 1 / n)


def rhat(chains: list[np.ndarray]) -> float:
    """Split R-hat: halve each chain, then compare between-half spread with within-half spread."""
    halves = []
    for c in chains:
        h = len(c) // 2
        halves += [np.asarray(c[:h]), np.asarray(c[h : 2 * h])]
    n = len(halves[0])
    means = np.array([h.mean() for h in halves])
    w = np.mean([h.var(ddof=1) for h in halves])
    b = n * means.var(ddof=1)
    var_plus = (n - 1) / n * w + b / n
    return float(np.sqrt(var_plus / w))

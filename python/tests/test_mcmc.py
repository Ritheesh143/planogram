"""The Metropolis sampler must recover a posterior we can write down exactly: the endcap's Beta(5, 15)."""

import numpy as np
import pytest
from ladder import ess, metropolis, rhat


def log_endcap(t: float) -> float:
    """log of t^4 (1 - t)^14: Beta(5, 15) without its normalizing constant."""
    if t <= 0 or t >= 1:
        return -np.inf
    return 4 * np.log(t) + 14 * np.log(1 - t)


@pytest.fixture(scope="module")
def chains():
    rng = np.random.default_rng(2024)
    out = []
    for start in [0.05, 0.35, 0.65, 0.95]:
        draws, acc = metropolis(log_endcap, start, 0.3, 6000, rng)
        assert 0.25 < acc < 0.45
        out.append(draws[1000:])
    return out


# The exact Beta(5, 15) curve as 100,000 thin bars, so the test needs nothing beyond numpy.
GRID = (np.arange(100_000) + 0.5) / 100_000
DENSITY = np.exp(np.vectorize(log_endcap)(GRID))
DENSITY /= DENSITY.sum()
CDF = np.cumsum(DENSITY)


def exact_quantile(q: float) -> float:
    return float(GRID[np.searchsorted(CDF, q)])


def test_recovers_the_beta_posterior(chains):
    draws = np.concatenate(chains)
    assert np.sum(DENSITY * GRID) == pytest.approx(0.25, abs=1e-6)
    assert draws.mean() == pytest.approx(0.25, abs=0.005)
    assert draws.std() == pytest.approx(np.sqrt(5 * 15 / (20**2 * 21)), abs=0.005)
    for q in [0.05, 0.5, 0.95]:
        assert np.quantile(draws, q) == pytest.approx(exact_quantile(q), abs=0.01)
    assert np.mean(draws > 0.3) == pytest.approx(1 - CDF[np.searchsorted(GRID, 0.3)], abs=0.015)
    # Largest gap between the sample's running share and the exact CDF (a Kolmogorov–Smirnov distance).
    sample = np.sort(draws[::10])
    gap = np.abs(np.arange(1, len(sample) + 1) / len(sample) - np.interp(sample, GRID, CDF)).max()
    assert gap < 0.03


def test_diagnostics_pass_for_healthy_chains(chains):
    assert rhat(chains) < 1.01
    assert sum(ess(c) for c in chains) > 2000


def test_diagnostics_catch_a_stuck_sampler():
    rng = np.random.default_rng(7)
    stuck = [metropolis(log_endcap, s, 0.003, 1000, rng)[0] for s in [0.05, 0.35, 0.65, 0.95]]
    assert rhat(stuck) > 1.5
    assert sum(ess(c) for c in stuck) < 100


def test_ess_of_independent_draws_is_about_n():
    rng = np.random.default_rng(1)
    assert ess(rng.normal(size=4000)) == pytest.approx(4000, rel=0.15)

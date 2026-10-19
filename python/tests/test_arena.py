"""The arena must be reproducible, and its from-scratch reference must match scikit-learn.
Needs the arena libraries: run with `npm run test:arena` (uses python/.venv)."""

import numpy as np
import pytest

pytest.importorskip("sklearn")
pytest.importorskip("lightgbm")
pytest.importorskip("xgboost")
pytest.importorskip("catboost")

from sklearn.ensemble import GradientBoostingRegressor  # noqa: E402

from arena.__main__ import run  # noqa: E402
from boltbeam import Config  # noqa: E402


def _strip_times(result):
    for sc in result["scenarios"]:
        for r in sc["results"].values():
            r.pop("seconds")
            r.pop("size_kb")
    return result


def test_arena_is_reproducible():
    cfg = Config(n_skus=8, days=300)
    a = _strip_times(run(cfg, ["baseline", "missing"]))
    b = _strip_times(run(cfg, ["baseline", "missing"]))
    assert a["scenarios"] == b["scenarios"]


def test_from_scratch_boosting_matches_sklearn():
    """Squared-loss boosting with stumps, written out, equals scikit-learn's GradientBoostingRegressor."""
    rng = np.random.default_rng(0)
    x = np.sort(rng.uniform(0, 10, 60))
    y = np.sin(x) * 5 + rng.normal(0, 1, 60)
    lr, rounds = 0.3, 25

    pred = np.full_like(y, y.mean())
    xs = np.unique(x)
    cuts = (xs[:-1] + xs[1:]) / 2
    for _ in range(rounds):
        r = y - pred
        best = None
        for t in cuts:
            left = x < t
            sse = ((r[left] - r[left].mean()) ** 2).sum() + ((r[~left] - r[~left].mean()) ** 2).sum()
            if best is None or sse < best[0] - 1e-12:
                best = (sse, t, r[left].mean(), r[~left].mean())
        _, t, lv, rv = best
        pred = pred + lr * np.where(x < t, lv, rv)

    sk = GradientBoostingRegressor(n_estimators=rounds, learning_rate=lr, max_depth=1, criterion="squared_error").fit(x.reshape(-1, 1), y)
    assert np.allclose(pred, sk.predict(x.reshape(-1, 1)), atol=1e-8)

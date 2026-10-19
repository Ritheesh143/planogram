"""Run the Model Arena and write public/data/arena.json.

    cd python && .venv/bin/python -m arena --out ../public/data/arena.json
    cd python && .venv/bin/python -m arena --quick        # a small run for checking the pipeline
"""

from __future__ import annotations

import argparse
import json
import platform
from pathlib import Path

import numpy as np

from boltbeam import Config

from .models import CONTESTANTS, SEED, fit_contestant
from .panel import TARGET, weekly_panel
from .scenarios import SCENARIOS, prepare


def wape(y, p):
    return float(np.abs(y - p).sum() / max(y.sum(), 1e-9))


def poisson_deviance(y, p):
    p = np.maximum(p, 1e-6)  # a Poisson model can't use a rate of zero or below
    with np.errstate(divide="ignore", invalid="ignore"):
        term = np.where(y > 0, y * np.log(y / p), 0.0)
    return float(2 * np.mean(term - (y - p)))


def price_rises(fitted, X):
    """Share of promo weeks where a 10% deeper price cut would lower the forecast: demand moving the
    wrong way. Only promo weeks are used, because that's where price varies in the data."""
    X = X[X["promo"] == 1]
    lo = X.copy()
    lo["price_ratio"] = lo["price_ratio"] * 0.9
    base = fitted.predict(X)
    cheaper = fitted.predict(lo)
    return float(np.mean(cheaper < base - 1e-9))


def run(cfg: Config, only: list[str] | None = None) -> dict:
    panel = prepare(weekly_panel(cfg))
    out = {"models": [{"id": c.id, "name": c.name, "family": c.family} for c in CONTESTANTS], "scenarios": []}
    for sc in SCENARIOS:
        if only and sc.id not in only:
            continue
        tr, te, num, cat = sc.build(panel)
        y_tr = tr[TARGET].to_numpy(float)
        y_te = te[TARGET].to_numpy(float)
        res = {}
        for c in CONTESTANTS:
            f = fit_contestant(c, tr, y_tr, num, cat)
            p = f.predict(te)
            r = {
                "wape": round(wape(y_te, p), 4),
                "deviance": round(poisson_deviance(y_te, p), 4),
                "rmse": round(float(np.sqrt(np.mean((y_te - p) ** 2))), 3),
                "bias": round(float((p.sum() - y_te.sum()) / max(y_te.sum(), 1e-9)), 4),
                "negative": round(float(np.mean(p < 0)), 4),
                "seconds": round(f.seconds, 2),
                "size_kb": None if np.isnan(f.size_kb) else round(f.size_kb, 1),
            }
            if sc.id == "baseline":
                r["price_rises"] = round(price_rises(f, te), 4)
            res[c.id] = r
            print(f"{sc.id:13s} {c.id:13s} wape {r['wape']:.3f} dev {r['deviance']:.3f} bias {r['bias']:+.3f} {r['seconds']:6.1f}s", flush=True)
        out["scenarios"].append(
            {
                "id": sc.id,
                "name": sc.name,
                "story": sc.story,
                "metric": sc.metric,
                "lesson": sc.lesson,
                "train_rows": int(len(tr)),
                "test_rows": int(len(te)),
                "results": res,
            }
        )
    out["meta"] = {"seed": cfg.seed, "stores": cfg.n_stores, "skus": cfg.n_skus, "days": cfg.days, "model_seed": SEED, "python": platform.python_version(), "versions": _versions()}
    return out


def _versions() -> dict:
    import catboost
    import lightgbm
    import sklearn
    import xgboost

    return {"scikit-learn": sklearn.__version__, "xgboost": xgboost.__version__, "lightgbm": lightgbm.__version__, "catboost": catboost.__version__}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--quick", action="store_true", help="12 SKUs and 400 days, for a fast check")
    ap.add_argument("--only", nargs="*")
    args = ap.parse_args()
    cfg = Config(n_skus=12, days=400) if args.quick else Config()
    result = run(cfg, args.only)
    if args.out:
        args.out.write_text(json.dumps(result, indent=1))
        print(f"wrote {args.out}")


if __name__ == "__main__":
    main()

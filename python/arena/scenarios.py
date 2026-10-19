"""The arena's scenarios: one realistic forecasting task, then variants that each stress one weakness."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd

from .panel import CATEGORICAL, IDS, NUMERIC, split_time


@dataclass
class Scenario:
    id: str
    name: str
    story: str
    metric: str  # "wape" or "deviance": what the leaderboard ranks on
    build: Callable[[pd.DataFrame], tuple[pd.DataFrame, pd.DataFrame, list[str], list[str]]]
    lesson: str = ""
    extra: dict = field(default_factory=dict)


def _with_categories(w: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Fix every category's levels on the full panel, so train and test share codes."""
    w = w.copy()
    for c in cols:
        w[c] = pd.Categorical(w[c], categories=sorted(w[c].unique()))
    return w


def baseline(w):
    tr, te = split_time(w)
    return tr, te, NUMERIC, CATEGORICAL


def big_stores(w):
    """Train on small and mid-size stores; test on the largest ones, beyond the training range."""
    tr, te = split_time(w)
    return tr[tr["size_ksqft"] < 75], te[te["size_ksqft"] > 85], NUMERIC, CATEGORICAL


def intermittent(w):
    """Only slow movers: the quarter of store-SKU series with the lowest average sales."""
    means = w.groupby(["store", "sku"])["sales"].transform("mean")
    tr, te = split_time(w[means <= means.quantile(0.25)])
    return tr, te, NUMERIC, CATEGORICAL


def ids_only(w):
    """No store or product attributes and no history: just store and SKU IDs, price, promo and season."""
    tr, te = split_time(w)
    num = ["price_ratio", "promo", "woy_sin", "woy_cos", "festive", "monsoon"]
    return tr, te, num, IDS


def missing(w):
    """A third of the history and price fields are blank, as when a POS feed drops out."""
    rng = np.random.default_rng(11)
    w = w.copy()
    for c in ["lag1", "lag2", "roll4", "price_ratio"]:
        w.loc[rng.random(len(w)) < 0.33, c] = np.nan
    tr, te = split_time(w)
    return tr, te, NUMERIC, CATEGORICAL


def small(w):
    """A new market: five stores, twelve SKUs and 16 weeks of history to learn from."""
    stores = sorted(w["store"].unique())[:5]
    skus = sorted(w["sku"].unique())[:12]
    sub = w[w["store"].isin(stores) & w["sku"].isin(skus)]
    tr, te = split_time(sub)
    tr = tr[tr["week_index"] >= tr["week_index"].max() - 15]
    return tr, te, NUMERIC, CATEGORICAL


def new_region(w):
    """Train without the South; forecast the South's stores."""
    tr, te = split_time(w)
    return tr[tr["region"] != "South"], te[te["region"] == "South"], NUMERIC, CATEGORICAL


SCENARIOS: list[Scenario] = [
    Scenario("baseline", "Weekly demand", "Forecast the next 26 weeks for every store and SKU, one week ahead, with price, promotions, season and recent sales.", "wape", baseline),
    Scenario("big_stores", "Bigger stores than ever", "Train on stores under 75k sq ft; forecast the chain's largest stores (over 85k sq ft).", "wape", big_stores, lesson="tree-vs-mlp"),
    Scenario("intermittent", "Slow movers", "Only the slowest quarter of store-SKU series, where many weeks sell little or nothing. Scored by Poisson deviance, which rewards getting the rate right on zero-heavy data.", "deviance", intermittent, lesson="mle-peak"),
    Scenario("ids_only", "IDs instead of attributes", "No store size, region, category or sales history: the models only see store and SKU IDs, so they must learn each ID's level.", "wape", ids_only, lesson="xgb-lgbm-catboost"),
    Scenario("missing", "Missing values", "A third of the lagged-sales and price fields are blank. Linear models, the MLP and scikit-learn's classic trees get mean-imputed data; the boosting libraries handle the gaps natively.", "wape", missing, lesson="xgb-lgbm-catboost"),
    Scenario("small", "A new market, 16 weeks", "Five stores, twelve SKUs and only 16 weeks of history.", "wape", small, lesson="linear-regression"),
    Scenario("new_region", "A region it has never seen", "Train without the South region; forecast the South's stores.", "wape", new_region),
]


def prepare(w: pd.DataFrame) -> pd.DataFrame:
    return _with_categories(w, CATEGORICAL + IDS)

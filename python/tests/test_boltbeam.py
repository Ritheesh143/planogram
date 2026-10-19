"""The generator is only useful for teaching if its planted truths can be recovered."""

import hashlib

import numpy as np
import pandas as pd
import pytest

from boltbeam import Config, generate, geometric_adstock, hill
from boltbeam.generator import BRANDS, DIWALI


@pytest.fixture(scope="module")
def data():
    return generate(Config(n_skus=30))


def _hash(a: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()


def _controls(dates: pd.DatetimeIndex) -> np.ndarray:
    """What an analyst would use without knowing the truth: trend-free Fourier terms,
    day of week, Diwali run-up windows and a monsoon flag."""
    t = np.arange(len(dates))
    cols = [np.ones(len(dates))]
    for k in range(1, 5):
        cols += [np.sin(2 * np.pi * k * t / 365.25), np.cos(2 * np.pi * k * t / 365.25)]
    dow = dates.dayofweek.values
    cols += [(dow == j).astype(float) for j in range(1, 7)]
    for lo, hi in [(0, 7), (8, 14), (15, 21)]:
        w = np.zeros(len(dates))
        for d in DIWALI:
            delta = (pd.Timestamp(d) - dates).days.values
            w += (delta >= lo) & (delta <= hi)
        cols.append(w)
    doy = dates.dayofyear.values
    cols.append(((doy >= 166) & (doy <= 258)).astype(float))
    return np.column_stack(cols)


def _national(data, column: str):
    daily = data["daily"]
    nat = daily.groupby(["date", "sku"]).agg(y=(column, "sum"), price=("price", "mean")).reset_index()
    ref = data["products"].set_index("sku")["ref_price"]
    nat["log_price_ratio"] = np.log(nat["price"] / nat["sku"].map(ref))
    Y = nat.pivot(index="date", columns="sku", values="y")
    LP = nat.pivot(index="date", columns="sku", values="log_price_ratio")
    return Y, LP


def _elasticities(data, column: str):
    Y, LP = _national(data, column)
    X0 = _controls(Y.index)
    out = []
    for pr in data["truth"]["cross_pairs"]:
        y = np.log(Y[pr["sku"]].values)
        X = np.column_stack([X0, LP[pr["sku"]].values, LP[pr["other"]].values])
        b = np.linalg.lstsq(X, y, rcond=None)[0]
        out.append((pr, data["truth"]["own_elasticity"][pr["sku"]], b[-2], b[-1]))
    return out


def test_same_seed_same_world():
    a = generate(Config(n_skus=8, days=120))
    b = generate(Config(n_skus=8, days=120))
    assert _hash(a["arrays"]["demand"]) == _hash(b["arrays"]["demand"])
    assert _hash(a["arrays"]["sales"]) == _hash(b["arrays"]["sales"])
    c = generate(Config(n_skus=8, days=120, seed=8))
    assert _hash(a["arrays"]["demand"]) != _hash(c["arrays"]["demand"])


def test_sales_are_censored_demand(data):
    daily = data["daily"]
    assert (daily["sales"] <= daily["demand"]).all()
    assert (daily["stockout"] == (daily["demand"] > daily["sales"])).all()
    # Lean enough to teach censoring, not so lean the data is mostly stockouts.
    assert 0.01 < daily["stockout"].mean() < 0.15


def test_hierarchy_is_coherent(data):
    daily = data["daily"].merge(data["stores"][["store", "region"]], on="store")
    national = daily.groupby("date")["sales"].sum()
    by_region = daily.groupby(["date", "region"])["sales"].sum().groupby("date").sum()
    by_store = daily.groupby(["date", "store"])["sales"].sum().groupby("date").sum()
    assert (national == by_region).all() and (national == by_store).all()


def test_planted_elasticities_are_recoverable_from_demand(data):
    results = _elasticities(data, "demand")
    own_err = [abs(est - true) for _, true, est, _ in results]
    cross_err = [abs(est - pr["cross_elasticity"]) for pr, _, _, est in results]
    assert np.mean(own_err) < 0.1 and max(own_err) < 0.2
    assert np.mean(cross_err) < 0.1 and max(cross_err) < 0.2
    for pr, _, _, cross in results:
        # Substitutes have a positive cross-elasticity, complements a negative one.
        assert np.sign(cross) == np.sign(pr["cross_elasticity"])


def test_censored_sales_shrink_the_elasticity(data):
    """Promotions cause stockouts, so sales understate the promo response: the lesson
    'Demand is not sales' depends on this being visible in the data."""
    from_demand = np.array([own for _, _, own, _ in _elasticities(data, "demand")])
    from_sales = np.array([own for _, _, own, _ in _elasticities(data, "sales")])
    assert np.mean(np.abs(from_sales)) < np.mean(np.abs(from_demand))


def test_adstock_decay_is_recoverable(data):
    """Grid-search the TV decay rate with the other channels at their true shape."""
    truth = data["truth"]["media"]
    media = data["media"]
    Y, LP = _national(data, "demand")
    y = np.log(Y.sum(axis=1).values)
    base = np.column_stack([_controls(Y.index), LP.mean(axis=1).values])

    def transformed(ch, theta):
        p = truth[ch]
        return hill(geometric_adstock(media[f"{ch}_spend"].values, theta), p["K"], p["S"])

    others = [transformed(ch, truth[ch]["theta"]) for ch in ["digital", "print", "in_store"]]
    sse = {}
    for theta in np.round(np.arange(0.1, 0.95, 0.05), 2):
        X = np.column_stack([base, transformed("tv", theta), *others])
        resid = y - X @ np.linalg.lstsq(X, y, rcond=None)[0]
        sse[theta] = float(resid @ resid)
    best = min(sse, key=sse.get)
    assert abs(best - truth["tv"]["theta"]) <= 0.1


def test_fraud_flag_matches_counting_worlds(data):
    r = data["returns"]
    f = data["truth"]["fraud"]
    assert abs(r["is_fraud"].mean() - f["base_rate"]) < 0.003
    precision = r.loc[r["flagged"], "is_fraud"].mean()
    expected = f["sensitivity"] * f["base_rate"] / (
        f["sensitivity"] * f["base_rate"] + f["false_alarm"] * (1 - f["base_rate"])
    )
    assert abs(precision - expected) < 0.03


def test_adstock_and_hill_shapes():
    impulse = np.zeros(10)
    impulse[0] = 1.0
    a = geometric_adstock(impulse, 0.5)
    assert np.allclose(a[:4], [1, 0.5, 0.25, 0.125])
    assert hill(np.array([0.0]), 10, 2)[0] == 0
    assert np.isclose(hill(np.array([10.0]), 10, 2)[0], 0.5)


def test_titles_cluster_by_product_concept():
    """With brand words removed, a title's nearest neighbour by shared words usually shares
    its subcategory: the latent concept the search lessons will try to recover."""
    products = generate(Config(n_skus=69, days=30))["products"]
    brand_words = {w.lower() for b in BRANDS for w in b.split()}
    tokens = [set(t.lower().split()) - brand_words for t in products["title"]]
    sizes = products["subcategory"].value_counts()
    with_siblings = [i for i in range(len(products)) if sizes[products["subcategory"].iloc[i]] > 1]
    hits = 0
    for i in with_siblings:
        scores = [len(tokens[i] & tj) / len(tokens[i] | tj) if j != i else -1 for j, tj in enumerate(tokens)]
        j = int(np.argmax(scores))
        hits += products["subcategory"].iloc[i] == products["subcategory"].iloc[j]
    assert hits / len(with_siblings) > 0.7

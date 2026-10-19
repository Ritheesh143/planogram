"""Bolt & Beam: a fictional Indian home-improvement chain with planted ground truth.

Every effect that lessons later try to estimate is a parameter here, recorded in
`truth`, so an estimate can be checked against the real answer:

- own- and cross-price elasticities (substitute and complement pairs)
- media adstock (geometric decay) and Hill saturation per channel
- festival and monsoon seasonality by category
- stockouts that censor demand (sales = min(demand, stock on hand))
- a returns fraud flag with known base rate, sensitivity and false-alarm rate
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

CITIES = [
    ("Pune", "West"), ("Mumbai", "West"), ("Bengaluru", "South"), ("Hyderabad", "South"),
    ("Chennai", "South"), ("Delhi", "North"), ("Jaipur", "North"), ("Kolkata", "East"),
]

# category -> (subcategories, typical price in rupees, base daily demand per store)
CATEGORIES = {
    "Power Tools": (["Cordless Drill", "Angle Grinder", "Jigsaw", "Drill Bits"], 4500, 1.2),
    "Paint": (["Interior Emulsion", "Exterior Emulsion", "Primer", "Paint Brush"], 1800, 2.5),
    "Plumbing": (["PVC Pipe", "Tap", "Sealant Tape"], 600, 2.0),
    "Electrical": (["LED Bulb", "Extension Board", "Switch"], 350, 3.0),
    "Garden": (["Hose", "Planter", "Lawn Mower"], 900, 1.0),
    "Lighting": (["Decorative String Light", "Ceiling Light", "Diya Lamp"], 700, 1.5),
    "Hardware": (["Screws", "Hinges", "Door Lock"], 250, 3.0),
}

BRANDS = ["Bolt Pro", "Beamline", "Kraftwell", "Sutra", "IronLeaf"]
DIWALI = ["2023-11-12", "2024-11-01", "2025-10-21", "2026-11-08"]
CHANNELS = ["tv", "digital", "print", "in_store"]


@dataclass
class Config:
    seed: int = 7
    n_stores: int = 40
    n_skus: int = 60
    days: int = 730
    start: str = "2024-01-01"
    lead_time: int = 3
    dispersion: float = 8.0  # negative-binomial shape: smaller = noisier than Poisson
    promo_share: float = 0.12  # share of SKU-weeks on promotion
    media: dict = field(default_factory=lambda: {
        # channel: adstock decay theta, Hill half-saturation K (spend units), Hill slope S, max lift beta
        "tv": {"theta": 0.7, "K": 50.0, "S": 1.5, "beta": 0.10},
        "digital": {"theta": 0.3, "K": 30.0, "S": 1.0, "beta": 0.06},
        "print": {"theta": 0.5, "K": 20.0, "S": 2.0, "beta": 0.03},
        "in_store": {"theta": 0.1, "K": 10.0, "S": 1.2, "beta": 0.04},
    })
    fraud: dict = field(default_factory=lambda: {"base_rate": 0.01, "sensitivity": 0.9, "false_alarm": 0.05, "return_rate": 0.03})


def geometric_adstock(x: np.ndarray, theta: float) -> np.ndarray:
    """a_t = x_t + theta * a_{t-1}: today's effective spend carries a fraction theta forward."""
    out = np.empty_like(x, dtype=float)
    carry = 0.0
    for t, v in enumerate(x):
        carry = v + theta * carry
        out[t] = carry
    return out


def hill(x: np.ndarray, K: float, S: float) -> np.ndarray:
    """Diminishing returns: 0 at x=0, 0.5 at x=K, approaching 1 as x grows."""
    x = np.maximum(x, 0.0)
    return x**S / (x**S + K**S)


def _products(rng: np.random.Generator, n_skus: int) -> pd.DataFrame:
    rows = []
    subs = [(cat, sub, price, base) for cat, (subs_, price, base) in CATEGORIES.items() for sub in subs_]
    for i in range(n_skus):
        cat, sub, price, base = subs[i % len(subs)]
        brand = BRANDS[(i // len(subs)) % len(BRANDS)]
        ref_price = round(price * rng.uniform(0.6, 1.6), -1)
        rows.append({
            "sku": f"SKU{i:04d}",
            "category": cat,
            "subcategory": sub,
            "brand": brand,
            "title": f"{brand} {sub} {_title_suffix(sub, rng)}",
            "ref_price": ref_price,
            "base_demand": base * rng.uniform(0.5, 1.5),
            "own_elasticity": round(float(rng.uniform(-2.2, -0.8)), 3),
        })
    return pd.DataFrame(rows)


def _title_suffix(sub: str, rng: np.random.Generator) -> str:
    options = {
        "Cordless Drill": ["20V with 2 Batteries", "12V Compact Kit", "18V Brushless"],
        "Drill Bits": ["Set of 13 HSS", "Masonry 5 Piece", "Wood Spade Set"],
        "Interior Emulsion": ["Matt White 10L", "Silk Finish 4L", "Washable 20L"],
        "Exterior Emulsion": ["Weatherproof 10L", "Anti-Algae 20L"],
        "Paint Brush": ["2 Inch Synthetic", "Set of 5", "4 Inch Wall Brush"],
        "LED Bulb": ["9W Cool Day Light", "12W Warm White Pack of 4"],
        "Decorative String Light": ["10m Warm Fairy Lights", "Multicolour 15m"],
        "Diya Lamp": ["Brass Set of 6", "Clay Pack of 12"],
    }
    choices = options.get(sub, ["Standard", "Premium", "Heavy Duty", "Value Pack"])
    return choices[int(rng.integers(len(choices)))]


def _focal_pairs(products: pd.DataFrame) -> list[dict]:
    """Plant cross-price effects: same-subcategory brands are substitutes; drill -> bits, emulsion -> brush are complements."""
    pairs = []
    for sub, grp in products.groupby("subcategory"):
        skus = grp["sku"].tolist()
        if len(skus) >= 2:
            pairs.append({"sku": skus[0], "other": skus[1], "kind": "substitute", "cross_elasticity": 0.6})
            pairs.append({"sku": skus[1], "other": skus[0], "kind": "substitute", "cross_elasticity": 0.4})
    first = lambda sub: products.loc[products["subcategory"] == sub, "sku"].iloc[0]  # noqa: E731
    for anchor, complement in [("Cordless Drill", "Drill Bits"), ("Interior Emulsion", "Paint Brush")]:
        if (products["subcategory"] == anchor).any() and (products["subcategory"] == complement).any():
            # Cheaper drills sell more drills, which sells more bits: a negative cross-elasticity.
            pairs.append({"sku": first(complement), "other": first(anchor), "kind": "complement", "cross_elasticity": -0.5})
    return pairs


def _seasonality(dates: pd.DatetimeIndex, products: pd.DataFrame) -> np.ndarray:
    """Multiplicative log-effects with shape (days, skus)."""
    n_days = len(dates)
    log_eff = np.zeros((n_days, len(products)))
    dow = dates.dayofweek.values
    log_eff += np.where(dow >= 5, np.log(1.25), 0.0)[:, None]

    # Festive build-up in the three weeks before Diwali.
    festive = np.zeros(n_days)
    for d in DIWALI:
        delta = (pd.Timestamp(d) - dates).days.values
        festive = np.maximum(festive, np.where((delta >= 0) & (delta <= 21), np.exp(-((delta - 5) ** 2) / 50), 0.0))
    festive_amp = products["category"].map({"Lighting": 1.2, "Paint": 0.6, "Power Tools": 0.3, "Electrical": 0.3}).fillna(0.1).values
    log_eff += np.log1p(festive[:, None] * festive_amp[None, :])

    # Monsoon: outdoor work stops, leaks start.
    doy = dates.dayofyear.values
    monsoon = ((doy >= 166) & (doy <= 258)).astype(float)
    monsoon_amp = products["category"].map({"Garden": -0.35, "Paint": -0.2, "Plumbing": 0.25}).fillna(0.0).values
    log_eff += monsoon[:, None] * monsoon_amp[None, :]
    return log_eff


def generate(cfg: Config | None = None) -> dict:
    cfg = cfg or Config()
    rng = np.random.default_rng(cfg.seed)
    dates = pd.date_range(cfg.start, periods=cfg.days, freq="D")

    stores = pd.DataFrame({
        "store": [f"S{i:02d}" for i in range(cfg.n_stores)],
        "city": [CITIES[i % len(CITIES)][0] for i in range(cfg.n_stores)],
        "region": [CITIES[i % len(CITIES)][1] for i in range(cfg.n_stores)],
        "size_ksqft": np.round(rng.uniform(20, 100, cfg.n_stores), 1),
    })
    store_effect = 0.6 * np.log(stores["size_ksqft"].values / 50) + rng.normal(0, 0.15, cfg.n_stores)

    products = _products(rng, cfg.n_skus)
    pairs = _focal_pairs(products)
    sku_index = {s: i for i, s in enumerate(products["sku"])}

    # Prices: national promotions on random SKU-weeks, 10-30% off.
    n_weeks = int(np.ceil(cfg.days / 7))
    on_promo = rng.random((n_weeks, cfg.n_skus)) < cfg.promo_share
    discount = np.where(on_promo, rng.uniform(0.1, 0.3, (n_weeks, cfg.n_skus)), 0.0)
    week_of_day = np.arange(cfg.days) // 7
    price_ratio = 1.0 - discount[week_of_day]  # (days, skus), price / reference price
    price = price_ratio * products["ref_price"].values[None, :]

    # Media: weekly national bursts per channel, then adstock and saturation.
    spend = {}
    media_log = np.zeros(cfg.days)
    for ch, p in cfg.media.items():
        weekly = np.where(rng.random(n_weeks) < 0.35, rng.gamma(2.0, p["K"] / 2.0, n_weeks), 0.0)
        daily = weekly[week_of_day] / 7.0
        spend[ch] = daily
        media_log += np.log1p(p["beta"] * hill(geometric_adstock(daily, p["theta"]), p["K"], p["S"]))

    # Log mean demand: (days, stores, skus).
    log_mu = (
        np.log(products["base_demand"].values)[None, None, :]
        + store_effect[None, :, None]
        + _seasonality(dates, products)[:, None, :]
        + (products["own_elasticity"].values[None, :] * np.log(price_ratio))[:, None, :]
        + media_log[:, None, None]
    )
    for pr in pairs:
        i, j = sku_index[pr["sku"]], sku_index[pr["other"]]
        log_mu[:, :, i] += pr["cross_elasticity"] * np.log(price_ratio[:, j])[:, None]
    mu = np.exp(log_mu)

    # Negative-binomial demand: a Poisson whose rate is itself gamma-distributed.
    k = cfg.dispersion
    demand = rng.poisson(rng.gamma(k, mu / k))

    # Inventory: (s, S) replenishment with a lead time, deliberately a little lean.
    avg = mu.mean(axis=0)
    reorder_point = np.ceil(avg * cfg.lead_time * 0.9)
    order_up_to = np.ceil(avg * (cfg.lead_time + 7))
    on_hand = order_up_to.copy()
    pipeline = np.zeros((cfg.lead_time,) + avg.shape)
    sales = np.zeros_like(demand)
    for t in range(cfg.days):
        on_hand += pipeline[0]
        pipeline = np.roll(pipeline, -1, axis=0)
        pipeline[-1] = 0
        sales[t] = np.minimum(demand[t], on_hand)
        on_hand -= sales[t]
        position = on_hand + pipeline.sum(axis=0)
        pipeline[-1] = np.where(position <= reorder_point, order_up_to - position, 0)
    stockout = demand > sales

    daily = pd.DataFrame({
        "date": np.repeat(dates.values, cfg.n_stores * cfg.n_skus),
        "store": np.tile(np.repeat(stores["store"].values, cfg.n_skus), cfg.days),
        "sku": np.tile(products["sku"].values, cfg.days * cfg.n_stores),
        "price": np.repeat(price, cfg.n_stores, axis=0).ravel().round(2),
        "on_promo": np.repeat(on_promo[week_of_day], cfg.n_stores, axis=0).ravel(),
        "demand": demand.ravel(),
        "sales": sales.ravel(),
        "stockout": stockout.ravel(),
    })

    # Returns: a share of units come back; a few are fraudulent; a flag screens them.
    f = cfg.fraud
    n_returns = int(rng.binomial(int(sales.sum()), f["return_rate"]))
    is_fraud = rng.random(n_returns) < f["base_rate"]
    flagged = rng.random(n_returns) < np.where(is_fraud, f["sensitivity"], f["false_alarm"])
    returns = pd.DataFrame({"return_id": np.arange(n_returns), "is_fraud": is_fraud, "flagged": flagged})

    media = pd.DataFrame({"date": dates, **{f"{ch}_spend": spend[ch].round(3) for ch in CHANNELS}})

    truth = {
        "seed": cfg.seed,
        "own_elasticity": dict(zip(products["sku"], products["own_elasticity"])),
        "cross_pairs": pairs,
        "media": cfg.media,
        "store_effect": dict(zip(stores["store"], np.round(store_effect, 4))),
        "fraud": f,
        "stockout_rate": float(stockout.mean()),
        "festive_amplitude": {"Lighting": 1.2, "Paint": 0.6, "Power Tools": 0.3, "Electrical": 0.3, "other": 0.1},
        "monsoon_log_effect": {"Garden": -0.35, "Paint": -0.2, "Plumbing": 0.25},
    }
    return {
        "stores": stores,
        "products": products,
        "daily": daily,
        "media": media,
        "returns": returns,
        "truth": truth,
        "arrays": {"demand": demand, "sales": sales, "mu": mu, "price_ratio": price_ratio, "media_log": media_log},
    }

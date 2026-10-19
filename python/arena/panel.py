"""Weekly store × SKU demand panel built from Bolt & Beam, with the features a forecaster would use."""

from __future__ import annotations

import numpy as np
import pandas as pd

from boltbeam import Config, generate
from boltbeam.generator import DIWALI

NUMERIC = ["price_ratio", "promo", "log_ref_price", "size_ksqft", "woy_sin", "woy_cos", "festive", "monsoon", "lag1", "lag2", "roll4"]
CATEGORICAL = ["category", "region"]
IDS = ["store", "sku"]
TARGET = "sales"


def weekly_panel(cfg: Config) -> pd.DataFrame:
    """One row per store, SKU and week, with lagged sales so every model can see recent history."""
    data = generate(cfg)
    d = data["daily"]
    week_start = d["date"].dt.to_period("W").dt.start_time
    w = (
        d.assign(week=week_start)
        .groupby(["week", "store", "sku"], sort=True)
        .agg(sales=("sales", "sum"), price=("price", "mean"), promo=("on_promo", "mean"), days=("date", "size"))
        .reset_index()
    )
    w = w[w["days"] == 7].drop(columns="days")  # drop a partial last week
    w = w.merge(data["products"][["sku", "category", "ref_price"]], on="sku").merge(data["stores"][["store", "region", "size_ksqft"]], on="store")
    w["price_ratio"] = w["price"] / w["ref_price"]
    w["log_ref_price"] = np.log(w["ref_price"])
    woy = w["week"].dt.isocalendar().week.astype(float).values
    w["woy_sin"] = np.sin(2 * np.pi * woy / 52.18)
    w["woy_cos"] = np.cos(2 * np.pi * woy / 52.18)
    # Festive flag: the week overlaps the three weeks before Diwali.
    days_to = np.full(len(w), 999.0)
    for dd in DIWALI:
        delta = (pd.Timestamp(dd) - w["week"]).dt.days.values
        days_to = np.where((delta >= -6) & (delta < days_to), delta, days_to)
    w["festive"] = ((days_to >= -6) & (days_to <= 21)).astype(float)
    doy = w["week"].dt.dayofyear.values
    w["monsoon"] = ((doy >= 166) & (doy <= 258)).astype(float)
    w = w.sort_values(["store", "sku", "week"]).reset_index(drop=True)
    g = w.groupby(["store", "sku"])["sales"]
    w["lag1"] = g.shift(1)
    w["lag2"] = g.shift(2)
    w["roll4"] = g.transform(lambda s: s.shift(1).rolling(4).mean())
    w = w.dropna(subset=["lag1", "lag2", "roll4"]).reset_index(drop=True)
    w["week_index"] = w.groupby("store")["week"].rank(method="dense").astype(int) - 1
    return w


def split_time(w: pd.DataFrame, test_weeks: int = 26) -> tuple[pd.DataFrame, pd.DataFrame]:
    cut = w["week_index"].max() - test_weeks
    return w[w["week_index"] <= cut].copy(), w[w["week_index"] > cut].copy()

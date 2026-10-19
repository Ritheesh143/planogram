"""The arena's contestants, each with the preprocessing it needs. Seeds and thread counts are fixed
so results are reproducible."""

from __future__ import annotations

import pickle
import time
import warnings
from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.exceptions import ConvergenceWarning
from sklearn.impute import SimpleImputer
from sklearn.linear_model import PoissonRegressor, Ridge
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, OrdinalEncoder, StandardScaler
from sklearn.tree import DecisionTreeRegressor

SEED = 7
THREADS = 4


@dataclass
class Fitted:
    predict: Callable[[pd.DataFrame], np.ndarray]
    seconds: float
    size_kb: float


@dataclass
class Contestant:
    id: str
    name: str
    family: str
    build: Callable[[list[str], list[str]], Callable[[pd.DataFrame, np.ndarray], object]]


def _dense_pre(num: list[str], cat: list[str]) -> ColumnTransformer:
    """Standardize numbers (mean-imputing gaps) and one-hot the categories: what linear models and MLPs need."""
    return ColumnTransformer(
        [
            ("num", make_pipeline(SimpleImputer(strategy="mean"), StandardScaler()), num),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat),
        ]
    )


# Sales-level features enter a log-link model as logs, so effects multiply as they do in the data.
LOG_COLS = ["lag1", "lag2", "roll4", "size_ksqft"]


def _log_pre(num: list[str], cat: list[str]) -> ColumnTransformer:
    logged = [c for c in num if c in LOG_COLS]
    plain = [c for c in num if c not in LOG_COLS]
    return ColumnTransformer(
        [
            ("log", make_pipeline(SimpleImputer(strategy="mean"), FunctionTransformer(np.log1p), StandardScaler()), logged),
            ("num", make_pipeline(SimpleImputer(strategy="mean"), StandardScaler()), plain),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat),
        ]
    )


def _ordinal_pre(num: list[str], cat: list[str]) -> ColumnTransformer:
    """Mean-impute numbers and code categories as integers: what scikit-learn's classic trees need."""
    return ColumnTransformer(
        [
            ("num", SimpleImputer(strategy="mean"), num),
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat),
        ]
    )


def _sk(pre: Callable, est: Callable):
    def build(num, cat):
        def fit(X, y):
            return make_pipeline(pre(num, cat), est()).fit(X[num + cat], y)

        return fit

    return build


def _native(kind: str, **params):
    """Libraries that take NaNs and categories as they are. Category columns arrive with a fixed
    pandas dtype (see scenarios.py), so training and test rows share one code for each level."""

    def build(num, cat):
        def fit(X, y):
            if kind == "hgb":
                m = HistGradientBoostingRegressor(categorical_features="from_dtype", random_state=SEED, **params)
            elif kind == "xgb":
                import xgboost as xgb

                m = xgb.XGBRegressor(tree_method="hist", enable_categorical=True, random_state=SEED, n_jobs=THREADS, **params)
            elif kind == "lgbm":
                import lightgbm as lgb

                m = lgb.LGBMRegressor(random_state=SEED, n_jobs=THREADS, deterministic=True, force_row_wise=True, verbose=-1, **params)
            else:
                from catboost import CatBoostRegressor

                m = CatBoostRegressor(random_seed=SEED, thread_count=THREADS, verbose=0, allow_writing_files=False, cat_features=cat, **params)
            m.fit(_prep(X, num, cat, kind), y)
            return _Native(m, num, cat, kind)

        return fit

    return build


def _prep(X: pd.DataFrame, num: list[str], cat: list[str], kind: str) -> pd.DataFrame:
    Xn = X[num + cat].copy()
    if kind == "catboost":
        for c in cat:
            Xn[c] = Xn[c].astype(str)
    return Xn


class _Native:
    def __init__(self, model, num, cat, kind):
        self.model, self.num, self.cat, self.kind = model, num, cat, kind

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return np.asarray(self.model.predict(_prep(X, self.num, self.cat, self.kind)), dtype=float)


CONTESTANTS: list[Contestant] = [
    Contestant("ridge", "Linear (ridge)", "linear", _sk(_dense_pre, lambda: Ridge(alpha=1.0))),
    Contestant("poisson", "Poisson GLM (log features)", "linear", _sk(_log_pre, lambda: PoissonRegressor(alpha=1e-4, max_iter=500))),
    Contestant("tree", "Decision tree", "tree", _sk(_ordinal_pre, lambda: DecisionTreeRegressor(max_depth=8, min_samples_leaf=20, random_state=SEED))),
    Contestant("rf", "Random forest", "tree", _sk(_ordinal_pre, lambda: RandomForestRegressor(n_estimators=100, min_samples_leaf=5, max_features=0.5, n_jobs=THREADS, random_state=SEED))),
    Contestant("hgb", "sklearn HistGB", "boosting", _native("hgb", max_iter=300, learning_rate=0.1)),
    Contestant("xgb", "XGBoost", "boosting", _native("xgb", n_estimators=300, learning_rate=0.1, max_depth=6, subsample=0.8, colsample_bytree=0.8)),
    Contestant("lgbm", "LightGBM", "boosting", _native("lgbm", n_estimators=300, learning_rate=0.1, num_leaves=31, subsample=0.8, subsample_freq=1, colsample_bytree=0.8)),
    Contestant(
        "lgbm_tweedie",
        "LightGBM (Tweedie)",
        "boosting",
        _native("lgbm", objective="tweedie", tweedie_variance_power=1.3, n_estimators=300, learning_rate=0.1, num_leaves=31, subsample=0.8, subsample_freq=1, colsample_bytree=0.8),
    ),
    Contestant("catboost", "CatBoost", "boosting", _native("catboost", iterations=300, learning_rate=0.1, depth=6)),
    Contestant(
        "mlp",
        "MLP",
        "neural",
        _sk(_dense_pre, lambda: MLPRegressor(hidden_layer_sizes=(64, 32), early_stopping=True, max_iter=200, random_state=SEED)),
    ),
]


def fit_contestant(c: Contestant, X: pd.DataFrame, y: np.ndarray, num: list[str], cat: list[str]) -> Fitted:
    t0 = time.perf_counter()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        model = c.build(num, cat)(X, y)
    seconds = time.perf_counter() - t0
    try:
        size_kb = len(pickle.dumps(model)) / 1024
    except Exception:  # some native boosters don't pickle cleanly; size is informational only
        size_kb = float("nan")
    return Fitted(predict=lambda Xt: np.asarray(model.predict(Xt), dtype=float), seconds=seconds, size_kb=size_kb)

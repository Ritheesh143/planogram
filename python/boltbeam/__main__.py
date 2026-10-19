"""Generate the Bolt & Beam dataset.

    python -m boltbeam --out ../data/boltbeam            # full CSVs (not committed)
    python -m boltbeam --sample ../public/data/boltbeam-sample.json
"""

import argparse
import json
from pathlib import Path

import numpy as np

from .generator import Config, generate


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--skus", type=int, default=60)
    ap.add_argument("--days", type=int, default=730)
    ap.add_argument("--out", type=Path, help="directory for full CSV tables and truth.json")
    ap.add_argument("--sample", type=Path, help="small JSON extract for the website")
    args = ap.parse_args()

    data = generate(Config(seed=args.seed, n_skus=args.skus, days=args.days))

    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        for name in ["stores", "products", "daily", "media", "returns"]:
            data[name].to_csv(args.out / f"{name}.csv.gz", index=False)
        (args.out / "truth.json").write_text(json.dumps(data["truth"], indent=2, default=float))
        print(f"wrote {len(data['daily']):,} store-SKU-days to {args.out}")

    if args.sample:
        daily = data["daily"]
        # Weekly national sales and demand for each planted pair, a compact teaching extract.
        skus = sorted({p["sku"] for p in data["truth"]["cross_pairs"]} | {p["other"] for p in data["truth"]["cross_pairs"]})[:8]
        weekly = (
            daily[daily["sku"].isin(skus)]
            .assign(week=lambda d: d["date"].dt.to_period("W").dt.start_time.dt.strftime("%Y-%m-%d"))
            .groupby(["sku", "week"], as_index=False)
            .agg(sales=("sales", "sum"), demand=("demand", "sum"), price=("price", "mean"), stockout_days=("stockout", "sum"))
        )
        sample = {
            "products": data["products"][data["products"]["sku"].isin(skus)].to_dict(orient="records"),
            "weekly": weekly.to_dict(orient="records"),
            "truth": {k: data["truth"][k] for k in ["cross_pairs", "media", "fraud", "stockout_rate"]},
        }
        args.sample.parent.mkdir(parents=True, exist_ok=True)
        args.sample.write_text(json.dumps(sample, default=lambda o: o.item() if isinstance(o, np.generic) else float(o)))
        print(f"wrote sample with {len(weekly)} weekly rows to {args.sample}")


if __name__ == "__main__":
    main()

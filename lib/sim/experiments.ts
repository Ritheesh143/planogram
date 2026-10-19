import { mean, normalQuantile, sampleSd, tQuantile } from "./prob";
import { normal, type Rng } from "./rng";

export type Interval = { estimate: number; lo: number; hi: number; covers: boolean };

/**
 * One endcap experiment: measure the sales lift in `stores` stores, where each store's
 * measured lift is the true lift plus store-level noise. Returns a t-interval for the mean.
 */
export function runExperiment(
  rng: Rng,
  opts: { stores: number; trueLift: number; noiseSd: number; level: number; useZ?: boolean },
): Interval {
  const lifts = Array.from({ length: opts.stores }, () => normal(rng, opts.trueLift, opts.noiseSd));
  const m = mean(lifts);
  const se = sampleSd(lifts) / Math.sqrt(opts.stores);
  const p = 1 - (1 - opts.level) / 2;
  // The t multiplier accounts for estimating the spread from few stores; z ignores it.
  const t = opts.useZ ? normalQuantile(p) : tQuantile(p, opts.stores - 1);
  const lo = m - t * se;
  const hi = m + t * se;
  return { estimate: m, lo, hi, covers: lo <= opts.trueLift && opts.trueLift <= hi };
}

export function runMany(rng: Rng, n: number, opts: Parameters<typeof runExperiment>[1]): Interval[] {
  return Array.from({ length: n }, () => runExperiment(rng, opts));
}

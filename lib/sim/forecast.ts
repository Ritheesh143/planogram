// Forecasting basics: the numbers behind Signature B, batch 2a. One Bolt & Beam store's daily sales
// taken apart (fc-anatomy), honest baselines scored by rolling origin (fc-baselines), exponential
// smoothing as geometric weights (fc-ets) and ARIMA read off the ACF and PACF (fc-arima).

import { mulberry32, normal, type Rng } from "./rng";

export const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
export function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

// ---------- fc-anatomy: one store's daily sales ----------

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The two weeks worked by hand: items sold per day at the Pune store, Monday to Sunday. */
export const HAND_WEEKS = [360, 350, 370, 380, 410, 480, 450, 375, 355, 380, 385, 425, 495, 455];

/** The planted truth: a trend of +10 items a week, a weekday pattern that sums to 0, and noise. */
export const STORE = { days: 112, level: 400, perWeek: 10, season: [-40, -50, -30, -20, 10, 80, 50], noise: 15 };
export const STORE_SEED = 5;

/**
 * Daily sales for one store: trend + weekday pattern + noise, rounded to whole items. Day 0 is a
 * Monday, and the trend is 400 on day 3 (the middle of week 1). The Pune store's first 14 days are the
 * hand-worked weeks; other stores (`hand: false`) are pure simulation.
 */
export function storeSeries(seed = STORE_SEED, days = STORE.days, hand = true, noise = STORE.noise, perWeek = STORE.perWeek): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: days }, (_, t) => {
    const e = normal(rng, 0, noise);
    if (hand && t < HAND_WEEKS.length) return HAND_WEEKS[t];
    return Math.round(STORE.level + (perWeek / 7) * (t - 3) + STORE.season[t % 7] + e);
  });
}

/**
 * Centred moving average with window w. An odd w averages w days; an even w uses the "2 × w" weights
 * (half weight on the two end days) so it stays centred. Days too near either end get null.
 */
export function movingAverage(y: number[], w: number): (number | null)[] {
  const half = Math.floor(w / 2);
  return y.map((_, t) => {
    if (t - half < 0 || t + half >= y.length) return null;
    let s = 0;
    for (let j = -half; j <= half; j++) {
      const wt = w % 2 === 0 && Math.abs(j) === half ? 0.5 : 1;
      s += wt * y[t + j];
    }
    return s / w;
  });
}

export type Decomposition = { trend: (number | null)[]; index: number[]; seasonal: number[]; remainder: (number | null)[] };

/**
 * Classical additive decomposition: trend = centred moving average; the weekday index is the average
 * of (sales − trend) for that weekday, shifted to sum to 0; remainder = sales − trend − index.
 */
export function decompose(y: number[], window = 7, period = 7): Decomposition {
  const trend = movingAverage(y, window);
  const sums = new Array<number>(period).fill(0);
  const counts = new Array<number>(period).fill(0);
  trend.forEach((tr, t) => {
    if (tr === null) return;
    sums[t % period] += y[t] - tr;
    counts[t % period]++;
  });
  const raw = sums.map((s, i) => s / counts[i]);
  const shift = mean(raw);
  const index = raw.map((v) => v - shift);
  const seasonal = y.map((_, t) => index[t % period]);
  const remainder = y.map((v, t) => (trend[t] === null ? null : v - (trend[t] as number) - seasonal[t]));
  return { trend, index, seasonal, remainder };
}

/** How much the trend line wiggles: the sd of its day-to-day changes. */
export function wiggle(trend: (number | null)[]): number {
  const t = trend.filter((v): v is number => v !== null);
  return sd(t.slice(1).map((v, i) => v - t[i]));
}

/**
 * Sample autocorrelation r_0 … r_maxLag. Each lag sums the n − k products of centred values, but
 * every lag divides by the same total sum of squares (that keeps the sequence a valid ACF).
 */
export function acf(y: number[], maxLag: number): number[] {
  const m = mean(y);
  const d = y.map((v) => v - m);
  const ss = d.reduce((s, v) => s + v * v, 0);
  return Array.from({ length: maxLag + 1 }, (_, k) => {
    let s = 0;
    for (let t = k; t < d.length; t++) s += d[t] * d[t - k];
    return s / ss;
  });
}

/** The pairs (y_(t−k), y_t) that the lag-k autocorrelation is built from. */
export const lagPairs = (y: number[], k: number) => y.slice(k).map((v, i) => [y[i], v] as const);

/** Pearson correlation of the pairs themselves (what a scatter plot "looks like"). */
export function pairCorr(pairs: readonly (readonly [number, number])[]): number {
  const a = pairs.map((p) => p[0]);
  const b = pairs.map((p) => p[1]);
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}

/** The ±1.96/√n band: where 95% of a pure-noise series' autocorrelations land. */
export const acfBand = (n: number) => 1.96 / Math.sqrt(n);

/**
 * Many pure-noise series of length n: what share of their autocorrelations at lags 1…lags fall
 * outside the band, and what share of series have at least one lag outside it?
 */
export function noiseStudy(series: number, n: number, lags: number, seed: number) {
  const rng = mulberry32(seed);
  const band = acfBand(n);
  let outside = 0;
  let anyOut = 0;
  const r7: number[] = [];
  for (let s = 0; s < series; s++) {
    const y = Array.from({ length: n }, () => normal(rng));
    const r = acf(y, lags).slice(1);
    const out = r.filter((v) => Math.abs(v) > band).length;
    outside += out;
    if (out > 0) anyOut++;
    r7.push(r[6]);
  }
  return { band, share: outside / (series * lags), anyShare: anyOut / series, r7 };
}

// ---------- fc-baselines: honest baselines and honest scores ----------

export type Method = "naive" | "snaive" | "mean28" | "weekday4";
export const METHODS: { id: Method; name: string }[] = [
  { id: "naive", name: "Naive (yesterday)" },
  { id: "snaive", name: "Seasonal naive (last week)" },
  { id: "mean28", name: "28-day average" },
  { id: "weekday4", name: "Same weekday, last 4 weeks" },
];

/** Forecast days origin … origin + h − 1 using only days before `origin`. */
export function baseline(method: Method, y: number[], origin: number, h: number): number[] {
  return Array.from({ length: h }, (_, i) => {
    const t = origin + i;
    switch (method) {
      case "naive":
        return y[origin - 1];
      case "snaive":
        return y[origin - 7 + (i % 7)];
      case "mean28":
        return mean(y.slice(origin - 28, origin));
      case "weekday4": {
        // The same weekday in each of the last four full weeks before the origin.
        const back = [1, 2, 3, 4].map((w) => y[t - 7 * (w + Math.floor(i / 7))]);
        return mean(back);
      }
    }
  });
}

/** WAPE: total absolute error over total sales. */
export function wape(actual: number[], fc: number[]): number {
  return actual.reduce((s, a, i) => s + Math.abs(a - fc[i]), 0) / actual.reduce((s, a) => s + a, 0);
}
/** Bias: total (forecast − actual) over total sales. Positive means over-forecasting. */
export function bias(actual: number[], fc: number[]): number {
  return actual.reduce((s, a, i) => s + (fc[i] - a), 0) / actual.reduce((s, a) => s + a, 0);
}
export const mae = (actual: number[], fc: number[]) => mean(actual.map((a, i) => Math.abs(a - fc[i])));
/** The MASE scale: in-sample MAE of the seasonal naive forecast (period m) on the training days. */
export function maseScale(train: number[], m = 7): number {
  return mean(train.slice(m).map((v, i) => Math.abs(v - train[i])));
}

/** The eight weekly folds: forecast days 56–62, 63–69, …, 105–111 from everything before. */
export const ORIGINS = [56, 63, 70, 77, 84, 91, 98, 105];
export const HORIZON = 7;

export type Fold = { origin: number; fc: number[]; actual: number[]; wape: number };

export function rollingOrigin(y: number[], method: Method, origins = ORIGINS, h = HORIZON) {
  const folds: Fold[] = origins.map((o) => {
    const fc = baseline(method, y, o, h);
    const actual = y.slice(o, o + h);
    return { origin: o, fc, actual, wape: wape(actual, fc) };
  });
  const allA = folds.flatMap((f) => f.actual);
  const allF = folds.flatMap((f) => f.fc);
  const scale = maseScale(y.slice(0, origins[0]));
  return { folds, wape: wape(allA, allF), bias: bias(allA, allF), mase: mae(allA, allF) / scale, scale };
}

/** Poisson pmf, computed in logs so large k is safe. */
export function poissonPmf(k: number, lambda: number): number {
  let lf = 0;
  for (let i = 2; i <= k; i++) lf += Math.log(i);
  return Math.exp(k * Math.log(lambda) - lambda - lf);
}

/** A slow mover: a premium drill selling 0.6 a day on average (Poisson). */
export const SLOW_RATE = 0.6;

/** Exact scores for forecasting a constant f every day for the slow mover. */
export function constantScores(f: number, lambda = SLOW_RATE) {
  let eAbs = 0;
  for (let k = 0; k <= 40; k++) eAbs += poissonPmf(k, lambda) * Math.abs(k - f);
  return { wape: eAbs / lambda, bias: (f - lambda) / lambda, rmse: Math.sqrt(lambda + (f - lambda) ** 2) };
}

/**
 * How much of a backtest score is luck? Simulate many stores from the same recipe as Pune and score
 * two baselines on the last week only and on the eight rolling folds. Each score is compared with its
 * expected value (the average over `reps` fresh stores), and we count how often each backtest picks
 * the baseline that is worse in expectation.
 */
export function holdoutStudy(stores: number, seed: number, a: Method = "snaive", b: Method = "weekday4", reps = 2000) {
  const score = (y: number[], m: Method) => [rollingOrigin(y, m, [105]).wape, rollingOrigin(y, m).wape];
  const sums = { a: [0, 0], b: [0, 0] };
  for (let k = 0; k < reps; k++) {
    const y = storeSeries(seed + stores + k, 112, false);
    score(y, a).forEach((v, i) => (sums.a[i] += v / reps));
    score(y, b).forEach((v, i) => (sums.b[i] += v / reps));
  }
  const res = { singleWrong: 0, rollingWrong: 0, singleErr: [] as number[], rollingErr: [] as number[] };
  for (let s = 0; s < stores; s++) {
    const y = storeSeries(seed + s, 112, false);
    const [sa, ra] = score(y, a);
    const [sb, rb] = score(y, b);
    if (sa < sb !== sums.a[0] < sums.b[0]) res.singleWrong++;
    if (ra < rb !== sums.a[1] < sums.b[1]) res.rollingWrong++;
    res.singleErr.push(sa - sums.a[0]);
    res.rollingErr.push(ra - sums.a[1]);
  }
  return {
    ...res,
    singleWrong: res.singleWrong / stores,
    rollingWrong: res.rollingWrong / stores,
    singleSpread: sd(res.singleErr),
    rollingSpread: sd(res.rollingErr),
    expected: { a: sums.a, b: sums.b },
  };
}

// ---------- fc-ets: exponential smoothing ----------

/** The six weeks smoothed by hand (items per week). The competitor opens before week 4. */
export const HAND_SES = [2800, 2860, 2780, 2500, 2520, 2480];

/** The store's weekly totals: level 2,800 until a competitor opens in week 31, then 2,500. */
export const WEEKLY = { weeks: 52, before: 2800, after: 2500, shiftWeek: 31, noise: 80 };
export const WEEKLY_SEED = 4;

export function weeklySeries(seed = WEEKLY_SEED): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: WEEKLY.weeks }, (_, i) => Math.round((i + 1 < WEEKLY.shiftWeek ? WEEKLY.before : WEEKLY.after) + normal(rng, 0, WEEKLY.noise)));
}

/**
 * Simple exponential smoothing: level_t = α·y_t + (1 − α)·level_(t−1), starting from level_1 = y_1.
 * fitted[t] is the one-step-ahead forecast of y_t (the level after week t − 1); fitted[0] is null.
 */
export function ses(y: number[], alpha: number) {
  const level: number[] = [y[0]];
  for (let t = 1; t < y.length; t++) level.push(alpha * y[t] + (1 - alpha) * level[t - 1]);
  const fitted = y.map((_, t) => (t === 0 ? null : level[t - 1]));
  let sse = 0;
  for (let t = 1; t < y.length; t++) sse += (y[t] - level[t - 1]) ** 2;
  return { level, fitted, sse, rmse: Math.sqrt(sse / (y.length - 1)) };
}

/** α on a 0.01 grid that minimizes the one-step-ahead squared error. */
export function bestAlpha(y: number[], step = 0.01): number {
  let best = step;
  let bestSse = Infinity;
  for (let k = 1; k * step <= 1 + 1e-9; k++) {
    const a = Number((k * step).toFixed(4));
    const s = ses(y, a).sse;
    if (s < bestSse) {
      bestSse = s;
      best = a;
    }
  }
  return best;
}

/** The weight SES puts on the observation j weeks back: α(1 − α)^j. */
export const sesWeight = (alpha: number, j: number) => alpha * (1 - alpha) ** j;
/** Weeks until a weight halves: ln ½ / ln(1 − α). */
export const halfLife = (alpha: number) => Math.log(0.5) / Math.log(1 - alpha);
/** Whole weeks until the level has absorbed 90% of a sudden shift: 1 − (1 − α)^k ≥ 0.9. */
export const weeksTo90 = (alpha: number) => (alpha >= 1 ? 1 : Math.ceil(Math.log(0.1) / Math.log(1 - alpha) - 1e-9));

/** The best α for a local-level world with signal-to-noise q = σ²_level / σ²_noise (steady-state Kalman gain). */
export const alphaStar = (q: number) => (-q + Math.sqrt(q * q + 4 * q)) / 2;

/** A local-level series: the level takes a random step of sd √q each week; noise sd 1 on top. */
export function localLevel(q: number, n: number, rng: Rng): number[] {
  let l = 0;
  return Array.from({ length: n }, () => {
    l += normal(rng, 0, Math.sqrt(q));
    return l + normal(rng);
  });
}

/** For each q, fit α by grid search on many simulated series and average the best α. */
export function alphaStudy(qs: number[], reps: number, n: number, seed: number) {
  const rng = mulberry32(seed);
  return qs.map((q) => {
    const fits = Array.from({ length: reps }, () => bestAlpha(localLevel(q, n, rng)));
    return { q, fitted: mean(fits), spread: sd(fits), theory: alphaStar(q) };
  });
}

// ---------- fc-arima: AR, MA and differencing ----------

export type Process = "ar1" | "ma1" | "rw" | "diff";

/** n values of an AR(1), MA(1), random walk or a differenced random walk, all driven by the same shocks. */
export function simulate(process: Process, coef: number, n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const e = Array.from({ length: n + 101 }, () => normal(rng));
  const out: number[] = [];
  let x = 0;
  let w = 0;
  for (let t = 1; t < e.length; t++) {
    if (process === "ar1") x = coef * x + e[t];
    else if (process === "ma1") x = e[t] + coef * e[t - 1];
    else {
      const prev = w;
      w += e[t];
      x = process === "rw" ? w : w - prev;
    }
    if (t > 100) out.push(x);
  }
  return out;
}

/** Partial autocorrelations at lags 1 … maxLag from the ACF, by the Durbin–Levinson recursion. */
export function pacf(y: number[], maxLag: number): number[] {
  return pacfFromAcf(acf(y, maxLag));
}

export function pacfFromAcf(r: number[]): number[] {
  const maxLag = r.length - 1;
  const out: number[] = [];
  let phi: number[] = [];
  for (let k = 1; k <= maxLag; k++) {
    let num = r[k];
    let den = 1;
    for (let j = 1; j < k; j++) {
      num -= phi[j - 1] * r[k - j];
      den -= phi[j - 1] * r[j];
    }
    const pkk = num / den;
    const next = phi.map((p, j) => p - pkk * phi[k - 2 - j]);
    next.push(pkk);
    phi = next;
    out.push(pkk);
  }
  return out;
}

/** The theoretical ACF r_1 … r_maxLag of each process (a random walk has none; its sample ACF hugs 1). */
export function theoryAcf(process: Process, coef: number, maxLag: number): (number | null)[] {
  return Array.from({ length: maxLag }, (_, i) => {
    const k = i + 1;
    if (process === "ar1") return coef ** k;
    if (process === "ma1") return k === 1 ? coef / (1 + coef * coef) : 0;
    if (process === "diff") return 0;
    return null;
  });
}

/** AR(1) point forecasts: the gap from the mean shrinks by φ each step. */
export const arForecast = (mu: number, phi: number, last: number, h: number) => mu + phi ** h * (last - mu);

/** Forecast-error sd h steps ahead: AR(1) levels off at σ/√(1 − φ²); a random walk grows like σ√h. */
export const arSd = (phi: number, sigma: number, h: number) => sigma * Math.sqrt((1 - phi ** (2 * h)) / (1 - phi * phi));
export const rwSd = (sigma: number, h: number) => sigma * Math.sqrt(h);

/** Simulated future paths from the last observation, for the fan chart. */
export function fanPaths(phi: number, mu: number, last: number, sigma: number, H: number, paths: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  return Array.from({ length: paths }, () => {
    let x = last;
    return Array.from({ length: H }, () => {
      x = mu + phi * (x - mu) + normal(rng, 0, sigma);
      return x;
    });
  });
}

/** The q-quantile of a sample (linear interpolation). */
export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = q * (s.length - 1);
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}

// Closed forms used by the lessons and checked against simulation in tests.

export function logFactorial(k: number): number {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

/** Likelihood of λ given observed counts: the product of each day's probability. */
export function poissonLikelihood(data: number[], lambda: number): number {
  return data.reduce((acc, k) => acc * poissonPmf(k, lambda), 1);
}

export function poissonLogLikelihood(data: number[], lambda: number): number {
  return data.reduce((acc, k) => acc + k * Math.log(lambda) - lambda - logFactorial(k), 0);
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sampleSd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function normalQuantile(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Student-t quantile via the Cornish-Fisher expansion around the normal (accurate for df >= 4). */
export function tQuantile(p: number, df: number): number {
  const z = normalQuantile(p);
  const z3 = z ** 3;
  const z5 = z ** 5;
  const z7 = z ** 7;
  return (
    z +
    (z3 + z) / (4 * df) +
    (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2) +
    (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3)
  );
}

export type WorldCounts = {
  total: number;
  fraud: number;
  caught: number;
  missed: number;
  genuine: number;
  falseAlarms: number;
  clear: number;
  /** Exact P(fraud | flagged) from Bayes' theorem (no rounding). */
  posterior: number;
};

/** Natural-frequency counts for a screening test applied to `total` cases. */
export function countWorlds(total: number, baseRate: number, sensitivity: number, falseAlarmRate: number): WorldCounts {
  const fraud = Math.round(total * baseRate);
  const caught = Math.round(fraud * sensitivity);
  const genuine = total - fraud;
  const falseAlarms = Math.round(genuine * falseAlarmRate);
  const pFlag = sensitivity * baseRate + falseAlarmRate * (1 - baseRate);
  return {
    total,
    fraud,
    caught,
    missed: fraud - caught,
    genuine,
    falseAlarms,
    clear: genuine - falseAlarms,
    posterior: pFlag === 0 ? 0 : (sensitivity * baseRate) / pFlag,
  };
}

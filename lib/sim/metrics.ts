// Forecast scores used by the Model Arena. Each one answers a different question.

/** Weighted absolute percentage error: total units missed ÷ total units sold. */
export function wape(y: number[], p: number[]): number {
  const miss = y.reduce((s, v, i) => s + Math.abs(v - p[i]), 0);
  return miss / y.reduce((s, v) => s + v, 0);
}

/** Total forecast minus total actual, as a share of actual: below zero means under-forecasting. */
export function bias(y: number[], p: number[]): number {
  const sy = y.reduce((s, v) => s + v, 0);
  return (p.reduce((s, v) => s + v, 0) - sy) / sy;
}

/** Mean Poisson deviance. A forecast of zero for a week that sold anything is punished very hard. */
export function poissonDeviance(y: number[], p: number[], floor = 1e-6): number {
  const terms = y.map((v, i) => {
    const mu = Math.max(p[i], floor);
    return (v > 0 ? v * Math.log(v / mu) : 0) - (v - mu);
  });
  return (2 * terms.reduce((s, t) => s + t, 0)) / y.length;
}

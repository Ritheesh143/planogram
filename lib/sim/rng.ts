// Seeded random numbers so every learner sees the same simulated worlds.

export type Rng = () => number;

/** mulberry32: small, fast, good enough for teaching simulations. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw (Box-Muller). */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Poisson draw by Knuth's method (fine for the small rates used in lessons). */
export function poisson(rng: Rng, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

export function binomial(rng: Rng, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

/** Gamma(shape, scale) draw by Marsaglia and Tsang's method. */
export function gamma(rng: Rng, shape: number, scale = 1): number {
  if (shape < 1) {
    // Boost the shape above 1, then scale back down: G(a) = G(a + 1) · U^(1/a).
    return gamma(rng, shape + 1, scale) * rng() ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

/** Negative binomial as a gamma-Poisson mixture: mean m, variance m + m²/k (smaller k, more skew). */
export function negBinomial(rng: Rng, mean: number, k: number): number {
  return poisson(rng, gamma(rng, k, mean / k));
}

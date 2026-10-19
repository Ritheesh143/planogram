// A small multilayer perceptron from scratch: ReLU hidden layers, a linear output,
// squared-error loss, backprop by the chain rule, and SGD or Adam. Deterministic given a seed.

import { mulberry32, normal } from "./rng";

export type Layer = { W: number[][]; b: number[] }; // W[out][in]

export type MLP = {
  layers: Layer[];
  /** Input scaling learned from the training data (identity if scaling is off). */
  xMean: number[];
  xSd: number[];
  yMean: number;
  ySd: number;
};

export type MLPOptions = {
  hidden?: number[];
  epochs?: number;
  lr?: number;
  optimizer?: "sgd" | "adam";
  seed?: number;
  /** Standardize inputs and target. Turning this off is a Failure Lab scenario. */
  scale?: boolean;
  /** L2 penalty on weights. */
  weightDecay?: number;
};

const relu = (v: number) => (v > 0 ? v : 0);

/** He initialization: weights ~ N(0, 2 / fan_in), biases 0. */
export function initLayers(sizes: number[], seed: number): Layer[] {
  const rng = mulberry32(seed);
  const layers: Layer[] = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l];
    layers.push({
      W: Array.from({ length: sizes[l + 1] }, () => Array.from({ length: fanIn }, () => normal(rng, 0, Math.sqrt(2 / fanIn)))),
      b: new Array(sizes[l + 1]).fill(0),
    });
  }
  return layers;
}

/** Forward pass returning every layer's pre-activations (z) and activations (a). */
export function forward(layers: Layer[], x: number[]): { zs: number[][]; as: number[][] } {
  const as: number[][] = [x];
  const zs: number[][] = [];
  let a = x;
  layers.forEach((layer, l) => {
    const z = layer.W.map((row, j) => row.reduce((s, w, i) => s + w * a[i], layer.b[j]));
    zs.push(z);
    a = l === layers.length - 1 ? z : z.map(relu);
    as.push(a);
  });
  return { zs, as };
}

export type Grads = { dW: number[][][]; db: number[][] };

/** Gradients of ½(ŷ − y)² for one row, flowing backward through the chain rule. */
export function backward(layers: Layer[], x: number[], y: number): { grads: Grads; pred: number } {
  const { zs, as } = forward(layers, x);
  const L = layers.length;
  const pred = as[L][0];
  let delta = [pred - y]; // dLoss/dz for the output layer
  const dW: number[][][] = new Array(L);
  const db: number[][] = new Array(L);
  for (let l = L - 1; l >= 0; l--) {
    dW[l] = delta.map((d) => as[l].map((a) => d * a));
    db[l] = [...delta];
    if (l > 0) {
      const prev = layers[l].W[0].map((_, i) => delta.reduce((s, d, j) => s + d * layers[l].W[j][i], 0));
      delta = prev.map((g, i) => (zs[l - 1][i] > 0 ? g : 0)); // ReLU passes gradient only where it was on
    }
  }
  return { grads: { dW, db }, pred };
}

/** `loss` is the training MSE before each epoch's update, in the target's units². */
export type TrainResult = { model: MLP; loss: number[] };

export function trainMLP(X: number[][], y: number[], opts: MLPOptions = {}): TrainResult {
  const { hidden = [16], epochs = 1500, lr = 0.01, optimizer = "adam", seed = 1, scale = true, weightDecay = 0 } = opts;
  const p = X[0].length;
  const n = X.length;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const sd = (v: number[], m: number) => Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
  const xMean = scale ? Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j]))) : new Array(p).fill(0);
  const xSd = scale ? Array.from({ length: p }, (_, j) => sd(X.map((r) => r[j]), xMean[j])) : new Array(p).fill(1);
  const yMean = scale ? mean(y) : 0;
  const ySd = scale ? sd(y, yMean) : 1;
  const Xs = X.map((r) => r.map((v, j) => (v - xMean[j]) / xSd[j]));
  const ys = y.map((v) => (v - yMean) / ySd);

  const layers = initLayers([p, ...hidden, 1], seed);
  // Adam state: first and second moment for every weight and bias.
  const zerosLike = () => ({ W: layers.map((l) => l.W.map((r) => r.map(() => 0))), b: layers.map((l) => l.b.map(() => 0)) });
  const m = zerosLike();
  const v = zerosLike();
  const b1 = 0.9;
  const b2 = 0.999;
  const loss: number[] = [];

  for (let ep = 1; ep <= epochs; ep++) {
    // Full-batch gradient: average over rows.
    const gW = layers.map((l) => l.W.map((r) => r.map(() => 0)));
    const gb = layers.map((l) => l.b.map(() => 0));
    let total = 0;
    for (let i = 0; i < n; i++) {
      const { grads, pred } = backward(layers, Xs[i], ys[i]);
      total += (pred - ys[i]) ** 2;
      grads.dW.forEach((W, l) => W.forEach((row, j) => row.forEach((g, k) => (gW[l][j][k] += g / n))));
      grads.db.forEach((bs, l) => bs.forEach((g, j) => (gb[l][j] += g / n)));
    }
    // Report mean squared error in the target's own units, so runs with and without scaling compare.
    loss.push((total / n) * ySd * ySd);
    layers.forEach((layer, l) => {
      const step = (g: number, mm: number[], vv: number[], k: number) => {
        if (optimizer === "sgd") return lr * g;
        mm[k] = b1 * mm[k] + (1 - b1) * g;
        vv[k] = b2 * vv[k] + (1 - b2) * g * g;
        const mh = mm[k] / (1 - b1 ** ep);
        const vh = vv[k] / (1 - b2 ** ep);
        return (lr * mh) / (Math.sqrt(vh) + 1e-8);
      };
      layer.W.forEach((row, j) =>
        row.forEach((w, k) => {
          row[k] = w - step(gW[l][j][k] + weightDecay * w, m.W[l][j], v.W[l][j], k);
        }),
      );
      layer.b.forEach((bb, j) => {
        layer.b[j] = bb - step(gb[l][j], m.b[l], v.b[l], j);
      });
    });
  }
  return { model: { layers, xMean, xSd, yMean, ySd }, loss };
}

export function predictMLP(model: MLP, row: number[]): number {
  const x = row.map((v, j) => (v - model.xMean[j]) / model.xSd[j]);
  const { as } = forward(model.layers, x);
  return as[as.length - 1][0] * model.ySd + model.yMean;
}

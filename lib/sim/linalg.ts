// Just enough linear algebra for the Model Lab, written to be read.
// A matrix is an array of rows: X[i][j] is row i (a week, a store) and column j (a feature).

export type Matrix = number[][];

export function transpose(A: Matrix): Matrix {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function matVec(A: Matrix, v: number[]): number[] {
  return A.map((row) => dot(row, v));
}

/** XᵀX: every pair of columns dotted together. */
export function xtx(X: Matrix): Matrix {
  const p = X[0].length;
  const out: Matrix = Array.from({ length: p }, () => new Array(p).fill(0));
  for (const row of X) {
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) out[a][b] += row[a] * row[b];
  }
  return out;
}

/** Xᵀy: each column dotted with the target. */
export function xty(X: Matrix, y: number[]): number[] {
  const p = X[0].length;
  const out = new Array(p).fill(0);
  X.forEach((row, i) => {
    for (let a = 0; a < p; a++) out[a] += row[a] * y[i];
  });
  return out;
}

/** Solve A·x = b by Gaussian elimination with partial pivoting. */
export function solve(A: Matrix, b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-12) throw new Error("singular matrix");
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

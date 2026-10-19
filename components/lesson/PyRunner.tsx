"use client";

import { useState } from "react";

const PYODIDE_VERSION = "314.0.7";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type Pyodide = {
  loadPackagesFromImports: (code: string) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<Pyodide>;
  }
}

let pyodidePromise: Promise<Pyodide> | null = null;

function loadPyodideOnce(): Promise<Pyodide> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = new Promise<Pyodide>((resolve, reject) => {
    const start = () => window.loadPyodide!({ indexURL: INDEX_URL }).then(resolve, reject);
    if (window.loadPyodide) return start();
    const script = document.createElement("script");
    script.src = `${INDEX_URL}pyodide.js`;
    script.onload = start;
    script.onerror = () => reject(new Error("Could not load Python from the CDN."));
    document.head.appendChild(script);
  }).catch((e) => {
    pyodidePromise = null;
    throw e;
  });
  return pyodidePromise;
}

/** Editable Python that runs in the browser (NumPy, pandas, scikit-learn, XGBoost, LightGBM). */
export function PyRunner({ code, title }: { code: string; title?: string }) {
  const [src, setSrc] = useState(code.trim());
  const [out, setOut] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "running" | "error">("idle");

  const run = async () => {
    setOut("");
    setState("loading");
    try {
      const py = await loadPyodideOnce();
      setState("running");
      let buf = "";
      py.setStdout({ batched: (s) => (buf += s + "\n") });
      py.setStderr({ batched: (s) => (buf += s + "\n") });
      await py.loadPackagesFromImports(src);
      await py.runPythonAsync(src);
      setOut(buf || "(no output)");
      setState("idle");
    } catch (e) {
      setOut(String(e instanceof Error ? e.message : e));
      setState("error");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-1" data-testid="pyrunner">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-xs font-medium text-ink-2">{title ?? "Python"} · runs in your browser</span>
        <button
          type="button"
          onClick={() => setSrc(code.trim())}
          className="ml-auto text-xs text-ink-2 hover:text-ink"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={run}
          disabled={state === "loading" || state === "running"}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {state === "loading" ? "Loading Python…" : state === "running" ? "Running…" : "Run ▶"}
        </button>
      </div>
      <textarea
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        spellCheck={false}
        aria-label="Python code"
        rows={Math.min(28, src.split("\n").length + 1)}
        className="block w-full resize-y bg-surface-1 p-3 font-mono text-[13px] leading-relaxed text-ink outline-none"
      />
      {out && (
        <pre
          data-testid="pyrunner-output"
          className={`max-h-80 overflow-auto border-t border-line bg-surface-2 p-3 font-mono text-[13px] ${
            state === "error" ? "text-critical" : "text-ink"
          }`}
        >
          {out}
        </pre>
      )}
      {state === "loading" && (
        <p className="border-t border-line px-3 py-2 text-xs text-muted">
          First run downloads Python (about 10 MB). Later runs are instant.
        </p>
      )}
    </div>
  );
}

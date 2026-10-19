"use client";

import { useSyncExternalStore } from "react";

// The current time, refreshed every 30 s. Null during server prerendering, where
// reading the clock would bake a build-time timestamp into the page.
let now = 0;

function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(() => {
    now = Date.now();
    onChange();
  }, 30_000);
  return () => window.clearInterval(id);
}

function getSnapshot(): number {
  if (!now) now = Date.now();
  return now;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** Call after an action that should be reflected immediately (e.g. answering a card). */
export function refreshNow(): void {
  now = Date.now();
}

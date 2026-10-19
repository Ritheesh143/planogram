"use client";

export function ThemeToggle() {
  const cycle = () => {
    const root = document.documentElement;
    const isDark =
      root.dataset.theme === "dark" ||
      (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("planogram:theme", next);
    } catch {
      // Theme still applies for this visit.
    }
  };
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label="Toggle light or dark theme"
      className="rounded-md px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-2.5"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
      </svg>
    </button>
  );
}

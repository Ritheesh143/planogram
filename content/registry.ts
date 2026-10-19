import type { ComponentType } from "react";

// MDX bodies for ready lessons and model pages. Planned lessons have no entry.
export const lessonBodies: Record<string, () => Promise<{ default: ComponentType }>> = {
  "counting-worlds": () => import("./lessons/foundations/counting-worlds.mdx"),
  "ci-repeat": () => import("./lessons/foundations/ci-repeat.mdx"),
  "likelihood-dial": () => import("./lessons/foundations/likelihood-dial.mdx"),
  "boosting-by-hand": () => import("./lessons/models/boosting-by-hand.mdx"),
  "mle-peak": () => import("./lessons/bayes/mle-peak.mdx"),
  "linear-regression": () => import("./models/linear-regression.mdx"),
  "decision-tree": () => import("./models/decision-tree.mdx"),
};

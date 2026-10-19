// The lesson template: Concrete -> Pictorial -> Simulation -> Formula, then practice.
export const SECTIONS = [
  { id: "floor", icon: "🛒", title: "Floor Problem" },
  { id: "hand", icon: "🔢", title: "Do It by Hand" },
  { id: "see", icon: "👀", title: "See It and Play" },
  { id: "simulate", icon: "🎲", title: "Simulate It" },
  { id: "formula", icon: "∑", title: "Now the Formula" },
  { id: "paper", icon: "✍️", title: "Pen and Paper" },
  { id: "build", icon: "🐍", title: "Build It" },
  { id: "production", icon: "🏭", title: "In Production" },
  { id: "interview", icon: "🎯", title: "Interview Lens" },
  { id: "recall", icon: "🧵", title: "Threads and Recall" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/** Sections every ready lesson's MDX must contain (Recall is appended by the page). */
export const AUTHORED_SECTIONS = SECTIONS.filter((s) => s.id !== "recall").map((s) => s.id);

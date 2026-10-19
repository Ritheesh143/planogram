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

// Model Lab pages: one model end to end, including where it breaks and where it leads.
export const MODEL_SECTIONS = [
  { id: "origin", icon: "🧬", title: "Origin" },
  { id: "hand", icon: "🔢", title: "By Hand" },
  { id: "see", icon: "👀", title: "Playground" },
  { id: "formula", icon: "∑", title: "The Math" },
  { id: "knobs", icon: "🎛", title: "Every Knob" },
  { id: "failure", icon: "💥", title: "Failure Lab" },
  { id: "build", icon: "🐍", title: "Build It" },
  { id: "production", icon: "🏭", title: "In Production" },
  { id: "leads", icon: "🧭", title: "Where It Leads" },
  { id: "paper", icon: "✍️", title: "Pen and Paper" },
  { id: "interview", icon: "🎯", title: "Interview Lens" },
  { id: "recall", icon: "🧵", title: "Threads and Recall" },
] as const;

export type LessonKind = "lesson" | "model";
export type SectionMeta = { id: string; icon: string; title: string };
export type SectionId = (typeof SECTIONS)[number]["id"] | (typeof MODEL_SECTIONS)[number]["id"];

export function sectionsFor(kind: LessonKind): readonly SectionMeta[] {
  return kind === "model" ? MODEL_SECTIONS : SECTIONS;
}

/** Sections a page's MDX must contain, in order (Recall is appended by the page). */
export function authoredSections(kind: LessonKind): string[] {
  return sectionsFor(kind)
    .filter((s) => s.id !== "recall")
    .map((s) => s.id);
}

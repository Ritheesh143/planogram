import { describe, expect, it } from "vitest";
import { marathon, sprintFocus, sprintTasks } from "@/content/plan";
import exercises from "@/content/exercises.generated.json";
import { allAisles, allLessons } from "@/lib/curriculum";
import { closure, crossings, layerOf, layoutGraph } from "@/lib/graphLayout";
import { indexExercises } from "@/scripts/index-exercises.mjs";

const nodes = allLessons.map((l) => ({ id: l.slug, group: l.aisle, prereqs: l.prereqs }));

describe("concept graph layout", () => {
  const layout = layoutGraph(nodes, allAisles.map((a) => a.id));
  it("puts every lesson to the right of all its prerequisites", () => {
    for (const l of allLessons) for (const p of l.prereqs) expect(layout.nodes.get(p)!.layer).toBeLessThan(layout.nodes.get(l.slug)!.layer);
  });
  it("never stacks two lessons on the same spot", () => {
    const spots = new Set([...layout.nodes.values()].map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(allLessons.length);
  });
  it("sweeps reduce crossings compared with no reordering", () => {
    const layer = layerOf(nodes);
    const naive = layoutGraph(nodes, allAisles.map((a) => a.id));
    // Rebuild the starting order (grouped by aisle) without sweeps for comparison.
    const groups = allAisles.map((a) => a.id);
    const layers: string[][] = [];
    for (const n of [...nodes].sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group))) (layers[layer.get(n.id)!] ??= []).push(n.id);
    const start = { ...naive, nodes: new Map(layers.flatMap((ids, l) => ids.map((id, i) => [id, { id, layer: l, order: i, x: 0, y: 0 }] as const))) };
    expect(crossings(layout, nodes)).toBeLessThanOrEqual(crossings(start, nodes));
  });
  it("finds a lesson's ancestors and descendants", () => {
    expect(closure(nodes, "gradient-boosting", "up")).toEqual(new Set(["boosting-by-hand", "decision-tree"]));
    expect(closure(nodes, "counting-worlds", "down").has("mmm-bayesian")).toBe(true);
  });
});

describe("plan content", () => {
  it("covers every sprint week with a focus and uses unique ids", () => {
    for (let w = 1; w <= 16; w++) expect(sprintFocus[w]).toBeTruthy();
    const ids = [...sprintTasks.map((t) => t.id), ...marathon.map((m) => m.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of sprintTasks) expect(t.week >= 1 && t.week <= 16).toBe(true);
  });
});

describe("exercise index", () => {
  it("is up to date with the lesson files (run: node scripts/index-exercises.mjs)", () => {
    expect(exercises).toEqual(indexExercises());
  });
  it("gives every ready lesson its exercises, numbered from 1", () => {
    for (const l of allLessons.filter((x) => x.status === "ready")) {
      const ns = exercises.filter((e) => e.slug === l.slug).map((e) => e.n);
      expect(ns.length).toBeGreaterThanOrEqual(5);
      expect(ns).toEqual(ns.map((_, i) => i + 1));
    }
  });
});

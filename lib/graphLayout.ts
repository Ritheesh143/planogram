// Layered layout for the prerequisite graph: each lesson sits one column to the right of its
// deepest prerequisite, and a few sweeps of the barycenter heuristic reduce edge crossings.

export type GraphNode = { id: string; group: string; prereqs: string[] };
export type Placed = { id: string; layer: number; order: number; x: number; y: number };

export type Layout = {
  nodes: Map<string, Placed>;
  layers: string[][];
  width: number;
  height: number;
};

export function layerOf(nodes: GraphNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const n = byId.get(id)!;
    const d = n.prereqs.length ? 1 + Math.max(...n.prereqs.map(depth)) : 0;
    memo.set(id, d);
    return d;
  };
  nodes.forEach((n) => depth(n.id));
  return memo;
}

export function layoutGraph(nodes: GraphNode[], groupOrder: string[], opts = { colWidth: 190, rowHeight: 34, pad: 20 }): Layout {
  const layer = layerOf(nodes);
  const depth = Math.max(...layer.values());
  const layers: string[][] = Array.from({ length: depth + 1 }, () => []);
  // Start each column grouped by aisle, so lessons from one aisle sit together.
  const groupRank = new Map(groupOrder.map((g, i) => [g, i]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of [...nodes].sort((a, b) => (groupRank.get(a.group) ?? 99) - (groupRank.get(b.group) ?? 99))) {
    layers[layer.get(n.id)!].push(n.id);
  }
  const children = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  nodes.forEach((n) => n.prereqs.forEach((p) => children.get(p)!.push(n.id)));

  const pos = () => new Map(layers.flatMap((l) => l.map((id, i) => [id, i] as const)));
  const bary = (ids: string[], neighbours: (id: string) => string[], at: Map<string, number>) => {
    const score = new Map(
      ids.map((id, i) => {
        const ns = neighbours(id);
        return [id, ns.length ? ns.reduce((s, x) => s + at.get(x)!, 0) / ns.length : i] as const;
      }),
    );
    return [...ids].sort((a, b) => score.get(a)! - score.get(b)!);
  };
  for (let sweep = 0; sweep < 6; sweep++) {
    for (let l = 1; l < layers.length; l++) layers[l] = bary(layers[l], (id) => byId.get(id)!.prereqs, pos());
    for (let l = layers.length - 2; l >= 0; l--) layers[l] = bary(layers[l], (id) => children.get(id)!, pos());
  }

  const tallest = Math.max(...layers.map((l) => l.length));
  const placed = new Map<string, Placed>();
  layers.forEach((ids, l) => {
    // Centre shorter columns vertically.
    const offset = ((tallest - ids.length) * opts.rowHeight) / 2;
    ids.forEach((id, i) => {
      placed.set(id, { id, layer: l, order: i, x: opts.pad + l * opts.colWidth, y: opts.pad + offset + i * opts.rowHeight });
    });
  });
  return { nodes: placed, layers, width: opts.pad * 2 + (layers.length - 1) * opts.colWidth + 160, height: opts.pad * 2 + tallest * opts.rowHeight };
}

/** Everything upstream (prerequisites, recursively) or downstream (what it unlocks) of a node. */
export function closure(nodes: GraphNode[], start: string, direction: "up" | "down"): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  nodes.forEach((n) => n.prereqs.forEach((p) => children.get(p)!.push(n.id)));
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    const next = direction === "up" ? byId.get(id)!.prereqs : children.get(id)!;
    for (const n of next) if (!seen.has(n)) {
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

/** Number of pairs of edges between the same two columns that cross. */
export function crossings(layout: Layout, nodes: GraphNode[]): number {
  const edges = nodes.flatMap((n) => n.prereqs.map((p) => [layout.nodes.get(p)!, layout.nodes.get(n.id)!] as const));
  let c = 0;
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const [a1, b1] = edges[i];
      const [a2, b2] = edges[j];
      if (a1.layer !== a2.layer || b1.layer !== b2.layer) continue;
      if ((a1.order - a2.order) * (b1.order - b2.order) < 0) c++;
    }
  return c;
}

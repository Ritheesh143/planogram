// Builds content/exercises.generated.json from every <Exercise n level title> in the lesson MDX,
// so the /exercises page can list them all without loading every lesson. Runs before each build.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "content", "exercises.generated.json");

function mdxFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? mdxFiles(p) : p.endsWith(".mdx") ? [p] : [];
  });
}

export function indexExercises() {
  const out = [];
  for (const file of mdxFiles(join(ROOT, "content")).sort()) {
    const slug = basename(file, ".mdx");
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/<Exercise\s+n=\{(\d+)\}\s+level="(easy|medium|hard)"\s+title="([^"]+)"/g)) {
      out.push({ slug, n: Number(m[1]), level: m[2], title: m[3] });
    }
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("index-exercises.mjs")) {
  const items = indexExercises();
  writeFileSync(OUT, JSON.stringify(items, null, 1) + "\n");
  console.log(`indexed ${items.length} exercises`);
}

// Recursive async file walkers used by build-time hooks (alt-link injection,
// llms.txt assembly). Pure I/O; no Astro types.

import { readdir } from "node:fs/promises";
import { join } from "node:path";

async function* walkFiles(
  dir: string,
  predicate: (filename: string) => boolean,
): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath, predicate);
    } else if (entry.isFile() && predicate(entry.name)) {
      yield fullPath;
    }
  }
}

export const walkHtmlFiles = (dir: string): AsyncGenerator<string> =>
  walkFiles(dir, (n) => n.endsWith(".html"));

export const walkMdFiles = (dir: string): AsyncGenerator<string> =>
  walkFiles(dir, (n) => n.endsWith(".md"));

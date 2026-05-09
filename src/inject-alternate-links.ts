// Build-time HTML rewriting that injects
//   <link rel="alternate" type="text/markdown">
// into every emitted HTML file whose URL has a registered .md sibling.
//
// Runs in `astro:build:done`, walking `dist/` to find every `.html` file. We
// derive the URL pathname back from the file path using Astro's standard
// output conventions (`index.html` → `/`, `foo/index.html` → `/foo`,
// `foo.html` → `/foo`), then look up the manifest for a matching .md sibling.
//
// Build-time rewriting complements the middleware path: middleware handles
// dev-mode and SSR responses; this handles static prerender output where
// middleware may not consistently fire across Astro versions.

import type { AstroIntegrationLogger } from "astro";
import { readFile, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { injectAlternateLink } from "./alt-link.js";
import { findMdSiblingFor, type Manifest } from "./manifest.js";
import { htmlFileToUrlPath } from "./paths.js";
import { walkHtmlFiles } from "./walk.js";

/**
 * Walks `distUrl`, injecting `<link rel="alternate" type="text/markdown">`
 * into every `.html` file whose URL pathname has a `.md` sibling in the
 * manifest. Returns the count of files modified.
 */
export async function injectAlternateLinks(
  distUrl: URL,
  manifest: Manifest,
  logger: AstroIntegrationLogger,
): Promise<number> {
  const distDir = fileURLToPath(distUrl);
  const startedAt = Date.now();
  let modifiedCount = 0;

  for await (const htmlFile of walkHtmlFiles(distDir)) {
    const urlPath = htmlFileToUrlPath(relative(distDir, htmlFile));
    const mdSibling = findMdSiblingFor(urlPath, manifest);
    if (!mdSibling) continue;

    const html = await readFile(htmlFile, "utf-8");
    const modified = injectAlternateLink(html, mdSibling);
    if (modified === null) continue;

    await writeFile(htmlFile, modified);
    modifiedCount++;
  }

  const elapsedMs = Date.now() - startedAt;
  if (modifiedCount > 0) {
    logger.info(
      `injected alternate links into ${modifiedCount} file${modifiedCount === 1 ? "" : "s"} in ${elapsedMs}ms`,
    );
  }

  return modifiedCount;
}

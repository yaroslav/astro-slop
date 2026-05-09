// astro:build:done generation for /llms.txt and /llms-full.txt.
//
// Walks dist/*.md, matches each file against the route manifest, parses
// metadata + body, assembles a flat auto-gen body, then either writes
// dist/llms.txt fresh OR, if the user's override endpoint already
// prerendered a sentinel-bearing file, splices the auto-gen body into
// the user's content.
//
// This is the build-only counterpart to the request-time fetch+crawl in
// llms-fetch.ts. Both paths produce the same logical output, just from
// different sources (disk-walk vs HTTP).

import { readFile, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { extractMeta, stripFrontmatter } from "./extract-meta.js";
import {
  assembleLlmsFullTxt,
  assembleLlmsTxt,
  type AssemblyOptions,
  type CapturedRoute,
} from "./llms-assembly.js";
import {
  findMdEntryFor,
  mdPatternToHtmlPattern,
  type Manifest,
} from "./manifest.js";
import { mdFileToUrlPath } from "./paths.js";
import { LLMS_FULL_TXT_SENTINEL, LLMS_TXT_SENTINEL } from "./sentinels.js";
import { walkMdFiles } from "./walk.js";

async function captureFromDisk(
  distUrl: URL,
  manifest: Manifest,
): Promise<CapturedRoute[]> {
  const distDir = fileURLToPath(distUrl);
  const captured: CapturedRoute[] = [];

  for await (const filePath of walkMdFiles(distDir)) {
    const mdUrl = mdFileToUrlPath(relative(distDir, filePath));
    const entry = findMdEntryFor(mdUrl, manifest);
    if (!entry) continue;

    const fullBody = await readFile(filePath, "utf-8");
    const meta = extractMeta(fullBody);
    const body = stripFrontmatter(fullBody).trim();
    const htmlUrl = mdPatternToHtmlPattern(mdUrl);

    captured.push({
      title: meta.title ?? htmlUrl,
      description: meta.description,
      body,
      mdUrl,
      htmlUrl,
    });
  }

  captured.sort((a, b) => a.mdUrl.localeCompare(b.mdUrl));
  return captured;
}

/**
 * Splice `autoGenBody` into the file at `path`:
 * - If the file exists and contains `sentinel`, replaceAll(sentinel, body).
 * - If the file exists and lacks the sentinel, leave it alone (user wrote
 *   their own content without calling defaultLlmsTxt — respect that).
 * - If the file is missing, write `autoGenBody` as a fresh file.
 */
async function fixupOrWrite(
  distUrl: URL,
  filename: string,
  sentinel: string,
  autoGenBody: string,
): Promise<void> {
  const path = fileURLToPath(new URL(filename, distUrl));
  let existing: string | undefined;
  try {
    existing = await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (existing === undefined) {
    await writeFile(path, autoGenBody);
    return;
  }

  if (existing.includes(sentinel)) {
    await writeFile(path, existing.replaceAll(sentinel, autoGenBody));
  }
}

/**
 * Generate (or fix up) dist/llms.txt and optionally dist/llms-full.txt at
 * astro:build:done time. The captures are gathered once and reused for both.
 */
export async function buildLlmsArtifacts(
  distUrl: URL,
  manifest: Manifest,
  options: AssemblyOptions,
  generateLlmsFull: boolean,
): Promise<void> {
  const captured = await captureFromDisk(distUrl, manifest);

  const llmsTxtBody = assembleLlmsTxt(captured, options);
  await fixupOrWrite(distUrl, "llms.txt", LLMS_TXT_SENTINEL, llmsTxtBody);

  if (generateLlmsFull) {
    const llmsFullTxtBody = assembleLlmsFullTxt(captured, options);
    await fixupOrWrite(
      distUrl,
      "llms-full.txt",
      LLMS_FULL_TXT_SENTINEL,
      llmsFullTxtBody,
    );
  }
}

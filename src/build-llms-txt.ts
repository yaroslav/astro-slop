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

import type { AstroIntegrationLogger } from "astro";
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
  logger: AstroIntegrationLogger,
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
  logger.info(
    `captured ${captured.length} markdown file${captured.length === 1 ? "" : "s"}`,
  );
  return captured;
}

/** Outcome of writing or splicing an llms.txt artifact at build time. */
type FixupOutcome =
  /** No file existed at this path; we wrote the auto-generated body fresh. */
  | "created"
  /** User's endpoint emitted a file containing the sentinel; we filled it in. */
  | "spliced"
  /** User's endpoint emitted a file without the sentinel; we left it alone. */
  | "skipped";

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
): Promise<FixupOutcome> {
  const path = fileURLToPath(new URL(filename, distUrl));
  let existing: string | undefined;
  try {
    existing = await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (existing === undefined) {
    await writeFile(path, autoGenBody);
    return "created";
  }

  if (existing.includes(sentinel)) {
    await writeFile(path, existing.replaceAll(sentinel, autoGenBody));
    return "spliced";
  }

  return "skipped";
}

function logArtifactOutcome(
  logger: AstroIntegrationLogger,
  filename: string,
  outcome: FixupOutcome,
): void {
  switch (outcome) {
    case "created":
      logger.info(`\`${filename}\` created at \`dist\``);
      return;
    case "spliced":
      logger.info(`\`${filename}\` updated at \`dist\``);
      return;
    case "skipped":
      logger.debug(
        `\`${filename}\` already exists without sentinel; left untouched`,
      );
      return;
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
  logger: AstroIntegrationLogger,
): Promise<void> {
  const captured = await captureFromDisk(distUrl, manifest, logger);

  const llmsTxtBody = assembleLlmsTxt(captured, options);
  const llmsTxtOutcome = await fixupOrWrite(
    distUrl,
    "llms.txt",
    LLMS_TXT_SENTINEL,
    llmsTxtBody,
  );
  logArtifactOutcome(logger, "llms.txt", llmsTxtOutcome);

  if (generateLlmsFull) {
    const llmsFullTxtBody = assembleLlmsFullTxt(captured, options);
    const llmsFullTxtOutcome = await fixupOrWrite(
      distUrl,
      "llms-full.txt",
      LLMS_FULL_TXT_SENTINEL,
      llmsFullTxtBody,
    );
    logArtifactOutcome(logger, "llms-full.txt", llmsFullTxtOutcome);
  }
}

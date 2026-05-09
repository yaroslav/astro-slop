// Request-time route capture for /llms.txt and /llms-full.txt in dev / SSR.
//
// Iterates manifest static .md routes, fetches each via HTTP using the
// incoming request's URL as the base, then crawls each response body for
// markdown links to other .md URLs (matching against per-entry patterns
// from the manifest): that's how we enumerate dynamic routes without
// invoking the user's `getStaticPaths` (which would re-trigger the broken
// raw-import path that v0.1.0 used).

import type { APIContext } from "astro";
import { extractMeta } from "./extract-meta.js";
import { stripFrontmatter } from "./extract-meta.js";
import {
  findMdEntryFor,
  mdPatternToHtmlPattern,
  type Manifest,
} from "./manifest.js";
import type { CapturedRoute } from "./llms-assembly.js";

// Matches markdown link targets that end in `.md`, e.g. `[text](/foo.md)`.
const MD_LINK_TARGET = /\(([^)]+\.md)\)/g;

function extractMdLinkTargets(body: string): string[] {
  const targets: string[] = [];
  for (const match of body.matchAll(MD_LINK_TARGET)) {
    targets.push(match[1]!);
  }
  return targets;
}

async function fetchAndCapture(
  base: URL,
  mdUrl: string,
): Promise<CapturedRoute | undefined> {
  const url = new URL(mdUrl, base);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    console.error(`astro-slop: fetch ${url.toString()} failed:`, error);
    return undefined;
  }
  if (!response.ok) {
    console.error(
      `astro-slop: fetch ${url.toString()} returned ${response.status}`,
    );
    return undefined;
  }
  const fullBody = await response.text();
  const meta = extractMeta(fullBody);
  const body = stripFrontmatter(fullBody).trim();
  const htmlUrl = mdPatternToHtmlPattern(mdUrl);
  return {
    title: meta.title ?? htmlUrl,
    description: meta.description,
    body,
    mdUrl,
    htmlUrl,
  };
}

/**
 * Capture every reachable `.md` route's body via HTTP from the live server.
 * Used by the injected /llms.txt and /llms-full.txt route handlers in dev
 * and SSR, and by `defaultLlmsTxt(context)` when called from a user-override
 * endpoint at request time.
 */
export async function captureViaFetch(
  context: APIContext,
  manifest: Manifest,
): Promise<CapturedRoute[]> {
  const base = new URL(context.request.url);
  const seen = new Set<string>();
  const captured: CapturedRoute[] = [];
  const queue: string[] = [];

  // Seed the queue with every static .md route. Per-entry routes are
  // discovered via the crawl below.
  for (const route of manifest.mdRoutes) {
    if (!route.isPerEntry) {
      queue.push(route.mdPattern);
    }
  }

  while (queue.length > 0) {
    const mdUrl = queue.shift()!;
    if (seen.has(mdUrl)) continue;
    seen.add(mdUrl);

    const result = await fetchAndCapture(base, mdUrl);
    if (!result) continue;
    captured.push(result);

    // Crawl: any `.md` URL referenced from this body that matches a
    // per-entry pattern in the manifest gets enqueued.
    const fetchedBase = new URL(mdUrl, base);
    for (const link of extractMdLinkTargets(result.body)) {
      let resolved: string;
      try {
        resolved = new URL(link, fetchedBase).pathname;
      } catch {
        continue;
      }
      if (seen.has(resolved)) continue;
      const entry = findMdEntryFor(resolved, manifest);
      if (entry) queue.push(resolved);
    }
  }

  captured.sort((a, b) => a.mdUrl.localeCompare(b.mdUrl));
  return captured;
}

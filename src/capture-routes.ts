// Shared route capture for /llms.txt and /llms-full.txt.
//
// For each .md route in the manifest, expand to concrete URLs (via
// getStaticPaths for dynamic routes), invoke each endpoint's GET to capture
// the emitted markdown, and parse out title + description metadata.
//
// /llms.txt uses title + description to format bullets.
// /llms-full.txt uses title + body to format sections.
// Both share this single iteration so per-route GET runs once per build.

import { expandRoute } from "./endpoint-loader.js";
import { extractMeta } from "./extract-meta.js";
import type { MdRouteEntry } from "./manifest.js";

const FRONTMATTER_BLOCK = /^---\n[\s\S]*?\n---\n*/;

function stripFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER_BLOCK, "");
}

export interface CapturedRoute {
  /** Title from frontmatter `title:` or first H1, fallback to htmlUrl. */
  title: string;
  /** Description from frontmatter `description:`, undefined if absent. */
  description: string | undefined;
  /** Endpoint body with leading frontmatter block removed, trimmed. */
  body: string;
  /** Concrete .md URL with params substituted. */
  mdUrl: string;
  /** Concrete HTML URL with params substituted. */
  htmlUrl: string;
}

/**
 * Iterate .md routes, expanding dynamic ones to concrete paths, invoking each
 * endpoint's GET, and parsing the emitted markdown for metadata. One bad
 * endpoint logs a console.error and is skipped — the rest still capture.
 */
export async function captureRoutes(
  routes: MdRouteEntry[],
): Promise<CapturedRoute[]> {
  const captured: CapturedRoute[] = [];

  for (const route of routes) {
    try {
      const expanded = await expandRoute(route);
      for (const e of expanded) {
        const response = await e.module.GET({
          params: e.params,
          props: e.props,
        });
        const fullBody = await response.text();
        const meta = extractMeta(fullBody);
        captured.push({
          title: meta.title ?? e.htmlUrl,
          description: meta.description,
          body: stripFrontmatter(fullBody).trim(),
          mdUrl: e.mdUrl,
          htmlUrl: e.htmlUrl,
        });
      }
    } catch (error) {
      console.error(
        `astro-slop: failed to capture ${route.mdPattern}:`,
        error,
      );
    }
  }

  return captured;
}

// Route manifest built during astro:routes:resolved.
//
// Walks the resolved routes, identifies .md routes (those whose URL pattern
// ends in `.md`), and pairs each one with its HTML sibling URL pattern.
//
// Two read views are pre-computed:
// - `mdRoutes`: ordered list of all .md routes (consumed by /llms.txt and
//   /llms-full.txt generators).
// - `htmlMatchers`: URL-pattern regexes for the corresponding HTML siblings
//   (consumed by middleware and the build-time HTML rewriter to test
//   incoming pathnames against dynamic patterns).

import type { IntegrationResolvedRoute } from "astro";

export interface MdRouteEntry {
  /** URL pattern of the .md endpoint, e.g. `/posts/[slug].md`. */
  mdPattern: string;
  /** URL pattern of the HTML sibling, e.g. `/posts/[slug]`. `/` for /index.md. */
  htmlPattern: string;
  /** Filesystem path of the .md endpoint's source file. */
  entrypoint: string;
  /** Whether this .md route has dynamic params (per-entry). Used to filter
   *  /llms-full.txt to bodies-only and to know when to expand via getStaticPaths. */
  isPerEntry: boolean;
}

export interface Manifest {
  /** All .md routes the user has declared, in route-resolution order. */
  mdRoutes: MdRouteEntry[];
  /** Regex matchers for HTML URL patterns that have .md siblings. */
  htmlMatchers: { regex: RegExp; htmlPattern: string }[];
  /** Regex matchers for .md URL patterns, paired with their manifest entry. */
  mdMatchers: { regex: RegExp; entry: MdRouteEntry }[];
}

const MD_SUFFIX = ".md";
const INDEX_MD_PATTERN = "/index.md";

/**
 * Convert an Astro URL pattern (e.g. `/posts/[slug]`) into a runtime regex
 * that matches request pathnames. Supports `[name]` and `[...rest]` segments.
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|\\]/g, "\\$&")
    .replace(/\[\.\.\.[^\]]+\]/g, "(.*)")
    .replace(/\[[^\]]+\]/g, "([^/]+)");
  return new RegExp(`^${escaped}/?$`);
}

/**
 * Given a .md route pattern, derive the URL pattern of its HTML sibling.
 * `/foo.md` → `/foo`, `/index.md` → `/`, `/foo/index.md` → `/foo`.
 */
export function mdPatternToHtmlPattern(mdPattern: string): string {
  if (mdPattern === INDEX_MD_PATTERN) return "/";
  if (mdPattern.endsWith("/index.md")) {
    return mdPattern.slice(0, -INDEX_MD_PATTERN.length) || "/";
  }
  if (mdPattern.endsWith(MD_SUFFIX)) {
    return mdPattern.slice(0, -MD_SUFFIX.length);
  }
  return mdPattern;
}

function isMdRoute(route: IntegrationResolvedRoute): boolean {
  return route.origin === "project" && route.pattern.endsWith(MD_SUFFIX);
}

function isPerEntryRoute(route: IntegrationResolvedRoute): boolean {
  return route.params.length > 0;
}

export function buildManifest(routes: IntegrationResolvedRoute[]): Manifest {
  const mdRoutes: MdRouteEntry[] = routes.filter(isMdRoute).map((r) => ({
    mdPattern: r.pattern,
    htmlPattern: mdPatternToHtmlPattern(r.pattern),
    entrypoint:
      typeof r.entrypoint === "string"
        ? r.entrypoint
        : String(r.entrypoint),
    isPerEntry: isPerEntryRoute(r),
  }));

  const htmlMatchers = mdRoutes.map((entry) => ({
    regex: patternToRegex(entry.htmlPattern),
    htmlPattern: entry.htmlPattern,
  }));

  const mdMatchers = mdRoutes.map((entry) => ({
    regex: patternToRegex(entry.mdPattern),
    entry,
  }));

  return { mdRoutes, htmlMatchers, mdMatchers };
}

/**
 * Find the manifest entry whose `.md` URL pattern matches the given concrete
 * `.md` URL, e.g. `/posts/hello-world.md` against pattern `/posts/[slug].md`.
 * Returns undefined if no pattern matches — typically a `.md` file in `dist/`
 * that wasn't produced by an `.md.ts` endpoint we know about.
 */
export function findMdEntryFor(
  mdUrl: string,
  manifest: Manifest,
): MdRouteEntry | undefined {
  for (const { regex, entry } of manifest.mdMatchers) {
    if (regex.test(mdUrl)) return entry;
  }
  return undefined;
}

/**
 * Look up the .md sibling URL for an incoming HTML pathname. Returns the
 * concrete .md URL (with `/` mapped to `/index.md`) or undefined if no
 * sibling is registered for any pattern matching the pathname.
 *
 * Always returns undefined for pathnames already ending in `.md` — a catch-all
 * pattern like `/[...rest].md` would otherwise match an `.md` request and the
 * function would return `/foo.md.md`.
 */
export function findMdSiblingFor(
  pathname: string,
  manifest: Manifest,
): string | undefined {
  if (pathname.endsWith(MD_SUFFIX)) return undefined;
  for (const { regex } of manifest.htmlMatchers) {
    if (regex.test(pathname)) {
      if (pathname === "/") return INDEX_MD_PATTERN;
      return pathname.replace(/\/$/, "") + MD_SUFFIX;
    }
  }
  return undefined;
}

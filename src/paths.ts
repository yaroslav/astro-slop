// Pure path/URL helpers shared by build-time HTML rewriting and runtime
// route expansion. Kept import-free so they can be unit-tested directly
// without pulling in Astro types or filesystem dependencies.

import { sep } from "node:path";

/**
 * Convert a relative dist file path back to its URL pathname.
 *
 *   "index.html"      → "/"
 *   "foo/index.html"  → "/foo"
 *   "foo.html"        → "/foo"
 *   "foo/bar.html"    → "/foo/bar"
 */
export function htmlFileToUrlPath(relPath: string): string {
  // Normalize to forward slashes regardless of host OS for URL derivation.
  const posix = relPath.split(sep).join("/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) {
    return "/" + posix.slice(0, -"/index.html".length);
  }
  if (posix.endsWith(".html")) {
    return "/" + posix.slice(0, -".html".length);
  }
  return "/" + posix;
}

/**
 * Substitute Astro-style URL pattern segments with concrete param values.
 * Handles both `[name]` and `[...rest]` segments. The rest form is replaced
 * first so that a literal `[name]` inside a `[...rest]` value isn't matched.
 */
export function substituteParams(
  pattern: string,
  params: Record<string, string>,
): string {
  let url = pattern;
  for (const [key, value] of Object.entries(params)) {
    // [...rest] segments
    url = url.replace(`[...${key}]`, value);
    // [name] segments
    url = url.replace(`[${key}]`, value);
  }
  return url;
}

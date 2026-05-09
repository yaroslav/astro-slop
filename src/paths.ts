// Pure path/URL helpers shared by build-time HTML rewriting and llms-txt
// assembly. Kept import-free so they can be unit-tested directly.

import { sep } from "node:path";

/**
 * Convert a relative dist file path back to its URL pathname for an HTML file.
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
 * Convert a relative dist file path back to its URL pathname for a markdown
 * file. Unlike HTML, `.md` URLs are served at their literal path with the
 * extension preserved.
 *
 *   "index.md"          → "/index.md"
 *   "posts.md"          → "/posts.md"
 *   "posts/hello.md"    → "/posts/hello.md"
 *   "posts/index.md"    → "/posts/index.md"
 */
export function mdFileToUrlPath(relPath: string): string {
  return "/" + relPath.split(sep).join("/");
}

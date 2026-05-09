// Shared logic for injecting <link rel="alternate" type="text/markdown">
// into an HTML document's <head>. Used by both the runtime middleware (dev
// and SSR) and the build-time HTML rewriter (static prerender output).
//
// Centralizing this here keeps the regex constants and tag formatting in one
// place; both call sites only differ in *where* the HTML comes from and where
// the result goes.

/** Matches the closing </head> tag (case-insensitive) for insertion point. */
const HEAD_CLOSING_TAG = /<\/head>/i;

/** Detects an existing alternate-markdown link so we don't double-inject. */
const ALREADY_INJECTED =
  /<link\s+[^>]*rel="alternate"[^>]*type="text\/markdown"/i;

/**
 * Insert a `<link rel="alternate" type="text/markdown" href="...">` tag
 * immediately before `</head>`. Returns the modified HTML, or `null` if no
 * change was made (already injected, or no `<head>` to inject into).
 */
export function injectAlternateLink(
  html: string,
  mdUrl: string,
): string | null {
  if (ALREADY_INJECTED.test(html)) return null;
  if (!HEAD_CLOSING_TAG.test(html)) return null;

  const linkTag = `<link rel="alternate" type="text/markdown" href="${mdUrl}">`;
  return html.replace(HEAD_CLOSING_TAG, `  ${linkTag}\n  </head>`);
}

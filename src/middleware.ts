// Astro middleware that handles two cross-cutting concerns at request time:
//
// 1. Content negotiation: if the client's Accept header prefers
//    text/markdown over text/html (and the URL has a .md sibling), redirect
//    to the .md variant.
// 2. Alt-link injection: if the response is HTML and the URL has a .md
//    sibling, inject `<link rel="alternate" type="text/markdown">` into
//    <head> so clients that read alt-links can discover the markdown view.
//
// Both fire only at request time, dev mode and SSR.

import type { MiddlewareHandler } from "astro";
import { injectAlternateLink } from "./alt-link.js";
import { findMdSiblingFor } from "./manifest.js";
import { prefersMarkdown } from "./prefers-markdown.js";
import { getSlopState } from "./state.js";

const HTML_MIME = "text/html";

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Skip middleware entirely for prerendered routes. Two reasons:
  // 1. `request.headers` access during prerender triggers an Astro warning
  //    (and the headers are empty anyway, since there's no real request).
  // 2. Static output is handled by the build:done HTML rewriter for
  //    alt-links, and content negotiation can't apply to baked files.
  if ("isPrerendered" in context && context.isPrerendered) {
    return next();
  }

  const state = getSlopState();
  const manifest = state.manifest;
  const options = state.options;

  // Content negotiation: 302 to the .md sibling when client prefers markdown.
  // Sets `Vary: Accept` so downstream caches don't serve the redirect to
  // clients with a different Accept header.
  if (
    options.contentNegotiation &&
    manifest &&
    prefersMarkdown(context.request.headers.get("Accept"))
  ) {
    const mdUrl = findMdSiblingFor(context.url.pathname, manifest);
    if (mdUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL(mdUrl, context.url).toString(),
          Vary: "Accept",
        },
      });
    }
  }

  const response = await next();

  if (!response.headers.get("Content-Type")?.includes(HTML_MIME)) {
    return response;
  }

  if (!options.injectAlternateLink || !manifest) return response;

  const mdUrl = findMdSiblingFor(context.url.pathname, manifest);
  if (!mdUrl) return response;

  const html = await response.text();
  const modified = injectAlternateLink(html, mdUrl);

  if (modified === null) {
    // Buffered the body but didn't change it; return a fresh Response so
    // the body stream isn't considered consumed by the caller.
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const headers = new Headers(response.headers);
  headers.delete("Content-Length");

  return new Response(modified, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

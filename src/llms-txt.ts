// /llms.txt route handler + the public `defaultLlmsTxt(context?)` helper.
//
// Three contexts can call into this module:
//
// 1. Integration's injected route at request time (dev / SSR). The handler
//    fetches every reachable .md route and assembles the body.
//
// 2. Integration's injected route during static build prerender. There's no
//    live server to fetch from, so the handler returns a sentinel string.
//    The integration's astro:build:done hook later replaces the sentinel
//    with the disk-derived auto-gen body.
//
// 3. A user's custom `src/pages/llms.txt.ts` calling `defaultLlmsTxt(context)`
//    to splice the auto-gen body into a wrapping document. Same prerender-
//    vs-runtime split as above; the build:done sentinel-replacement preserves
//    the user's wrapping content while filling in the auto-gen body.

import type { APIContext, APIRoute } from "astro";
import { assembleLlmsTxt } from "./llms-assembly.js";
import { captureViaFetch } from "./llms-fetch.js";
import { LLMS_TXT_SENTINEL } from "./sentinels.js";
import { getSlopState } from "./state.js";

const TEXT_PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
} satisfies HeadersInit;

function isPrerenderContext(context: APIContext): boolean {
  return "isPrerendered" in context && context.isPrerendered === true;
}

/**
 * Returns the auto-generated /llms.txt body.
 *
 * - In a live request context (dev / SSR): fetches every static .md route and
 *   crawls links to per-entry siblings, then returns the assembled body.
 * - In a static prerender context, or when called without context: returns a
 *   sentinel string. The integration's `astro:build:done` hook scans the
 *   prerendered file and substitutes the auto-gen body for the sentinel.
 *
 * Pass the APIContext from your endpoint when wrapping with custom content
 * so dev / SSR runs work the same as static builds.
 */
export async function defaultLlmsTxt(context?: APIContext): Promise<string> {
  if (!context || isPrerenderContext(context)) {
    return LLMS_TXT_SENTINEL;
  }

  const state = getSlopState();
  if (!state.manifest) {
    throw new Error(
      "astro-slop: defaultLlmsTxt() called before manifest was built. " +
        "This is a plugin-internal sequencing bug; please file an issue.",
    );
  }

  const captured = await captureViaFetch(context, state.manifest);
  return assembleLlmsTxt(captured, state.options);
}

export const GET: APIRoute = async (context) => {
  const body = await defaultLlmsTxt(context);
  return new Response(body, { headers: TEXT_PLAIN_HEADERS });
};

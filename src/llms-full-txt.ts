// /llms-full.txt route handler + the public `defaultLlmsFullTxt(context?)`
// helper. Mirrors llms-txt.ts; see that file's header for the full design.

import type { APIContext, APIRoute } from "astro";
import { assembleLlmsFullTxt } from "./llms-assembly.js";
import { captureViaFetch } from "./llms-fetch.js";
import { LLMS_FULL_TXT_SENTINEL } from "./sentinels.js";
import { getSlopState } from "./state.js";

const TEXT_PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
} satisfies HeadersInit;

function isPrerenderContext(context: APIContext): boolean {
  return "isPrerendered" in context && context.isPrerendered === true;
}

/**
 * Returns the auto-generated /llms-full.txt body.
 *
 * Same prerender / request-time semantics as `defaultLlmsTxt(context)` —
 * sentinel during prerender (replaced at build:done), full body via fetch
 * crawl in dev / SSR.
 */
export async function defaultLlmsFullTxt(
  context?: APIContext,
): Promise<string> {
  if (!context || isPrerenderContext(context)) {
    return LLMS_FULL_TXT_SENTINEL;
  }

  const state = getSlopState();
  if (!state.manifest) {
    throw new Error(
      "astro-slop: defaultLlmsFullTxt() called before manifest was built. " +
        "This is a plugin-internal sequencing bug; please file an issue.",
    );
  }

  const captured = await captureViaFetch(context, state.manifest);
  return assembleLlmsFullTxt(captured, state.options);
}

export const GET: APIRoute = async (context) => {
  const body = await defaultLlmsFullTxt(context);
  return new Response(body, { headers: TEXT_PLAIN_HEADERS });
};

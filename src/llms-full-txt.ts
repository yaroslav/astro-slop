// /llms-full.txt auto-generation.
//
// Mirrors /llms.txt's section structure (Pages / Posts) but inlines each
// route's full body content instead of just the bullet link. The result is
// a single document an LLM can ingest to get every piece of unique prose
// content the site exposes as markdown.
//
// `defaultLlmsFullTxt()` returns the body string. Wrap from a custom
// src/pages/llms-full.txt.ts to extend or filter.

import type { APIRoute } from "astro";
import { captureRoutes, type CapturedRoute } from "./capture-routes.js";
import { getSlopState } from "./state.js";

const TEXT_PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
} satisfies HeadersInit;

function sectionList(captures: CapturedRoute[]): string[] {
  return captures.flatMap((c) => [`### ${c.title}`, "", c.body, ""]);
}

/**
 * Returns the auto-generated /llms-full.txt body as a string.
 *
 * Wrap this from a custom `src/pages/llms-full.txt.ts` to extend or filter.
 */
export async function defaultLlmsFullTxt(): Promise<string> {
  const state = getSlopState();
  if (!state.manifest) {
    throw new Error(
      "astro-slop: defaultLlmsFullTxt() called before manifest was built. " +
        "This is a plugin-internal sequencing bug; please file an issue.",
    );
  }

  const { siteName, siteDescription } = state.options;
  const pageCaptures = await captureRoutes(
    state.manifest.mdRoutes.filter((r) => !r.isPerEntry),
  );
  const postCaptures = await captureRoutes(
    state.manifest.mdRoutes.filter((r) => r.isPerEntry),
  );

  const lines: string[] = [`# ${siteName ?? "Site"}`, ""];

  if (siteDescription) {
    lines.push(`> ${siteDescription}`, "");
  }

  if (pageCaptures.length > 0) {
    lines.push("## Pages", "", ...sectionList(pageCaptures));
  }

  if (postCaptures.length > 0) {
    lines.push("## Posts", "", ...sectionList(postCaptures));
  }

  return lines.join("\n").trimEnd() + "\n";
}

export const GET: APIRoute = async () =>
  new Response(await defaultLlmsFullTxt(), { headers: TEXT_PLAIN_HEADERS });

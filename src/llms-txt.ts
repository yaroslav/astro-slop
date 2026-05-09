// /llms.txt auto-generation.
//
// `defaultLlmsTxt()` returns the auto-gen body as a string; exported for
// users who want to extend the index from their own /llms.txt endpoint.
// The default route handler in this file just wraps it in a Response.
//
// Each route is rendered as a bullet `- [Title](url) — description`,
// grouped into `## Pages` (static routes) and `## Posts` (per-entry routes).
// Title and description come from the endpoint's emitted markdown
// (frontmatter `title:`/`description:` or first H1 fallback).

import type { APIRoute } from "astro";
import { captureRoutes, type CapturedRoute } from "./capture-routes.js";
import { md } from "./md.js";
import { getSlopState } from "./state.js";

const TEXT_PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
} satisfies HeadersInit;

function bulletList(captures: CapturedRoute[]): string[] {
  return captures.map((c) => {
    const link = md.link(c.title, c.mdUrl);
    return c.description ? `- ${link} — ${c.description}` : `- ${link}`;
  });
}

/**
 * Returns the auto-generated /llms.txt body as a string.
 *
 * Wrap this from a custom `src/pages/llms.txt.ts` to extend the index with
 * additional sections that the plugin doesn't know about (press, references,
 * external links, etc.).
 */
export async function defaultLlmsTxt(): Promise<string> {
  const state = getSlopState();
  if (!state.manifest) {
    throw new Error(
      "astro-slop: defaultLlmsTxt() called before manifest was built. " +
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
    lines.push("## Pages", "", ...bulletList(pageCaptures), "");
  }

  if (postCaptures.length > 0) {
    lines.push("## Posts", "", ...bulletList(postCaptures), "");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export const GET: APIRoute = async () =>
  new Response(await defaultLlmsTxt(), { headers: TEXT_PLAIN_HEADERS });

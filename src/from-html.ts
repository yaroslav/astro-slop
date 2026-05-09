// fromHtml(url, options): returns a GET handler that fetches the HTML at `url`,
// runs it through Defuddle for content extraction + cleanup + markdown
// conversion, and returns a Response with text/markdown content-type.
//
// Defuddle handles main-content detection (strips nav, footer, sidebars, etc.)
// and HTML=>Markdown conversion in one pass. Pass `defuddleOptions` to forward
// any other Defuddle settings. See https://github.com/kepano/defuddle.
//
// Works in `astro dev` and SSR modes (a server is running, so fetch resolves).
// In static prerender, pre-rendering may run before the corresponding HTML
// file exists, so this helper is best paired with SSR or hybrid output.

import type { APIRoute } from "astro";

export interface FromHtmlOptions {
  /** Pass-through options to Defuddle. See defuddle/node docs for the full set. */
  defuddleOptions?: Record<string, unknown>;
}

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
} satisfies HeadersInit;

const TEXT_PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
} satisfies HeadersInit;

export function fromHtml(url: string, options: FromHtmlOptions = {}): APIRoute {
  return async ({ request }) => {
    const targetUrl = new URL(url, request.url).toString();

    let html: string;
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return new Response(
          `astro-slop: fetch ${targetUrl} returned ${response.status}`,
          { status: 502, headers: TEXT_PLAIN_HEADERS },
        );
      }
      html = await response.text();
    } catch (error) {
      return new Response(
        `astro-slop: fetch ${targetUrl} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { status: 502, headers: TEXT_PLAIN_HEADERS },
      );
    }

    const [{ Defuddle }, { parseHTML }] = await Promise.all([
      import(/* @vite-ignore */ "defuddle/node"),
      import(/* @vite-ignore */ "linkedom"),
    ]);

    const { document } = parseHTML(html);
    // Spread user options first so `markdown: true` can't be silently
    // overridden — we always want markdown out, since we set the
    // text/markdown content-type below.
    const result = await Defuddle(document, targetUrl, {
      ...options.defuddleOptions,
      markdown: true,
    });

    return new Response(result.content, { headers: MARKDOWN_HEADERS });
  };
}

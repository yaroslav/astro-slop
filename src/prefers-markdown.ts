// HTTP Accept-header parsing for content negotiation.
//
// Returns true when the client's Accept header explicitly ranks one of the
// recognized markdown MIME types higher than text/html. Browsers don't list
// markdown in their default Accept (typically `text/html, ..., */*`) so they
// never trigger; LLM-aware clients that explicitly request `text/markdown`
// (or `text/x-markdown`) get the .md variant.
//
// We deliberately ignore wildcard matches like `*/*;q=0.8` — those would
// always tie for both markdown and HTML, defeating the negotiation. Both
// types must be explicitly listed in the Accept header for the comparison
// to consider them.

interface AcceptEntry {
  type: string;
  q: number;
}

const MARKDOWN_TYPES = ["text/markdown", "text/x-markdown"] as const;
const HTML_TYPE = "text/html";

function parseAccept(header: string): AcceptEntry[] {
  return header.split(",").map((part) => {
    const [type, ...params] = part.trim().split(";");
    let q = 1;
    for (const p of params) {
      const trimmed = p.trim();
      if (trimmed.startsWith("q=")) {
        const parsed = Number.parseFloat(trimmed.slice(2));
        if (!Number.isNaN(parsed)) q = parsed;
      }
    }
    return { type: type.trim().toLowerCase(), q };
  });
}

function exactQuality(entries: AcceptEntry[], target: string): number {
  let best = 0;
  for (const e of entries) {
    if (e.type === target && e.q > best) best = e.q;
  }
  return best;
}

/**
 * Returns true if the Accept header explicitly prefers markdown over HTML.
 * Conservatively treats ties and missing headers as "no markdown preference."
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;

  const entries = parseAccept(acceptHeader);
  const markdownQ = Math.max(
    ...MARKDOWN_TYPES.map((t) => exactQuality(entries, t)),
  );
  const htmlQ = exactQuality(entries, HTML_TYPE);

  return markdownQ > htmlQ;
}

// cleanMdx(body): strips MDX-specific syntax from a content collection entry's
// raw body, leaving plain Markdown suitable for .md output.
//
// What gets stripped:
// - Top-level `import` and `export` statements (single-line and multi-line)
// - JSX components (uppercase tag start), self-closing or paired — paired
//   keeps inner content, self-closing drops the whole element
// - Triple-or-more blank lines collapsed to a single blank line
//
// What's preserved:
// - All HTML (lowercase tags): valid in Markdown, LLMs parse it fine,
//   user-written HTML often carries semantic intent (`<address>`, `<time>`,
//   `<cite>`, etc.). If you want HTML scrubbed, run a separate sanitizer pass.
// - All actual prose, lists, code blocks, links, emphasis
// - `{javascript expressions}` left as literal text. LLMs handle them fine.
//
// NOTE: this is a regex-based cleanup, not a full MDX parser.

// Multi-line import/export with a brace block: `import { a, b } from "x";` or
// `export const foo = { ... };` — possibly spanning multiple lines. Must run
// before IMPORT_EXPORT_LINE so brace blocks aren't truncated to their first line.
const IMPORT_EXPORT_BLOCK =
  /^(import|export)\s+[^\n{]*\{[\s\S]*?\}[^;\n]*;?[ \t]*$/gm;
// Single-line import/export with no brace block.
const IMPORT_EXPORT_LINE = /^(import|export)\s+[^\n]*$/gm;
const SELF_CLOSING_JSX = /<([A-Z][\w.]*)\b[^>]*\/>/g;
const PAIRED_JSX = /<([A-Z][\w.]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
const EXCESS_BLANK_LINES = /\n{3,}/g;

export function cleanMdx(body: string): string {
  if (!body) return "";

  let cleaned = body;

  cleaned = cleaned.replace(IMPORT_EXPORT_BLOCK, "");
  cleaned = cleaned.replace(IMPORT_EXPORT_LINE, "");
  cleaned = cleaned.replace(SELF_CLOSING_JSX, "");

  // Run paired stripper twice for nested cases — the first pass handles
  // outermost components, freeing inner ones to match in the second pass.
  cleaned = cleaned.replace(PAIRED_JSX, "$2");
  cleaned = cleaned.replace(PAIRED_JSX, "$2");

  cleaned = cleaned.replace(EXCESS_BLANK_LINES, "\n\n");

  return cleaned.trim() + "\n";
}

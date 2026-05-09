// Extract title and description from a markdown string.
//
// Tries in order:
// 1. YAML frontmatter `title:` and `description:` fields
// 2. First-level heading (`# Title`) as title
//
// Returns whatever it can find. Either field may be undefined.

const FRONTMATTER_BLOCK = /^---\n([\s\S]*?)\n---/;
const FRONTMATTER_LEADING = /^---\n[\s\S]*?\n---\n*/;
const FRONTMATTER_TITLE = /^title:\s*(.+?)\s*$/m;
const FRONTMATTER_DESCRIPTION = /^description:\s*(.+?)\s*$/m;
const FIRST_H1 = /^#\s+(.+?)\s*$/m;

const QUOTES = /^["']|["']$/g;

/** Strip a leading YAML frontmatter block from the start of a markdown string. */
export function stripFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER_LEADING, "");
}

function unquote(value: string): string {
  return value.replace(QUOTES, "");
}

export interface ExtractedMeta {
  title?: string;
  description?: string;
}

export function extractMeta(markdown: string): ExtractedMeta {
  const meta: ExtractedMeta = {};

  const fmMatch = markdown.match(FRONTMATTER_BLOCK);
  if (fmMatch) {
    const fm = fmMatch[1];
    const titleMatch = fm.match(FRONTMATTER_TITLE);
    if (titleMatch) meta.title = unquote(titleMatch[1]);
    const descMatch = fm.match(FRONTMATTER_DESCRIPTION);
    if (descMatch) meta.description = unquote(descMatch[1]);
  }

  if (!meta.title) {
    const h1Match = markdown.match(FIRST_H1);
    if (h1Match) meta.title = h1Match[1];
  }

  return meta;
}

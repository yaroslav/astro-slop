// `md` tagged template: returns a Response with text/markdown content-type.
//
// The tag dedents based on the template literal's own indentation
// (computed from the static string fragments only, not from interpolated
// values). This lets users indent the template for readability without that
// indent leaking into output, even when interpolations contain
// un-indented multi-line content like bullet lists.
//
// `md.link`, `md.heading`, `md.section` are inline string helpers — used inside
// the template as interpolations, not as the endpoint's return value.

type Interpolation =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null
  | undefined;

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
} satisfies HeadersInit;

interface MdTag {
  (strings: TemplateStringsArray, ...values: Interpolation[]): Response;
  /** Same template semantics as `md\`...\`` but returns the string instead of a Response. Use for sub-composition or for wrapping in a custom Response (e.g., text/plain for llms.txt). */
  string: (strings: TemplateStringsArray, ...values: Interpolation[]) => string;
  link: (text: string, url: string) => string;
  heading: (depth: number, text: string) => string;
  section: (heading: string, body: string) => string;
}

// Compute the minimum indent across all non-empty lines in the *template
// strings*, ignoring interpolated values entirely. Interpolated content can be
// anything (including bullet lists with no leading whitespace), which would
// otherwise drag minIndent to zero and prevent dedenting the wrapping template.
function computeMinIndent(strings: TemplateStringsArray): number {
  const allLines = strings.flatMap((s) => s.split("\n"));
  const indents = allLines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^[ \t]*/)![0].length);
  return indents.length > 0 ? Math.min(...indents) : 0;
}

function dedentString(s: string, n: number): string {
  if (n === 0) return s;
  return s
    .split("\n")
    .map((l) => {
      const leading = l.match(/^[ \t]*/)![0].length;
      return l.slice(Math.min(leading, n));
    })
    .join("\n");
}

function assembleMarkdown(
  strings: TemplateStringsArray,
  values: Interpolation[],
): string {
  const minIndent = computeMinIndent(strings);
  const fragments = strings.map((s) => dedentString(s, minIndent));

  const parts: string[] = [];
  fragments.forEach((s, i) => {
    parts.push(s);
    if (i < values.length) {
      const v = values[i];
      if (v == null) return;
      parts.push(Array.isArray(v) ? v.join("\n") : String(v));
    }
  });

  return parts.join("").trim() + "\n";
}

const mdTag = ((
  strings: TemplateStringsArray,
  ...values: Interpolation[]
): Response => {
  return new Response(assembleMarkdown(strings, values), {
    headers: MARKDOWN_HEADERS,
  });
}) as MdTag;

mdTag.string = (strings, ...values) => assembleMarkdown(strings, values);

mdTag.link = (text, url) => `[${text.replace(/[[\]]/g, "\\$&")}](${url})`;

mdTag.heading = (depth, text) => `${"#".repeat(depth)} ${text}`;

mdTag.section = (heading, body) => `${heading}\n\n${body}`;

export const md = mdTag;

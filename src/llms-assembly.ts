// Pure body builders for /llms.txt and /llms-full.txt. Take a list of
// captured routes plus site-level options and return the formatted string.

// Inlined twin of md.link to keep this module import-free for unit tests.
// Behavior must match src/md.ts; covered by md.link tests there.
function mdLink(text: string, url: string): string {
  return `[${text.replace(/[[\]]/g, "\\$&")}](${url})`;
}

export interface CapturedRoute {
  /** Title from frontmatter `title:` or first H1, fallback to htmlUrl. */
  title: string;
  /** Description from frontmatter `description:`, undefined if absent. */
  description: string | undefined;
  /** Endpoint body with leading frontmatter block removed, trimmed. */
  body: string;
  /** Concrete .md URL with params substituted. */
  mdUrl: string;
  /** Concrete HTML URL with params substituted. */
  htmlUrl: string;
}

export interface AssemblyOptions {
  siteName?: string;
  siteDescription?: string;
}

function bulletList(captures: CapturedRoute[]): string[] {
  return captures.map((c) => {
    const link = mdLink(c.title, c.mdUrl);
    return c.description ? `- ${link} — ${c.description}` : `- ${link}`;
  });
}

function sectionList(captures: CapturedRoute[]): string[] {
  return captures.flatMap((c) => [`### ${c.title}`, "", c.body, ""]);
}

function header(options: AssemblyOptions): string[] {
  const lines: string[] = [`# ${options.siteName ?? "Site"}`, ""];
  if (options.siteDescription) {
    lines.push(`> ${options.siteDescription}`, "");
  }
  return lines;
}

export function assembleLlmsTxt(
  captures: CapturedRoute[],
  options: AssemblyOptions,
): string {
  const lines = header(options);
  if (captures.length > 0) {
    lines.push(...bulletList(captures), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function assembleLlmsFullTxt(
  captures: CapturedRoute[],
  options: AssemblyOptions,
): string {
  const lines = header(options);
  if (captures.length > 0) {
    lines.push(...sectionList(captures));
  }
  return lines.join("\n").trimEnd() + "\n";
}

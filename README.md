# astro-slop

[![npm](https://img.shields.io/npm/v/astro-slop?color=cb3837&logo=npm)](https://www.npmjs.com/package/astro-slop)

Content slop for LLMs to slurp. The most complete and flexible Astro integration for LLMs and generating markdown versions of pages. 

<div align="center">
  <img src="https://raw.githubusercontent.com/yaroslav/astro-slop/refs/heads/main/assets/images/astro-slop.png" width="256" height="256" alt="astro-slop">
</div>

- `.md` siblings for every page. Flexible, bottom-up, fully customizable approach: you create simple endpoints with the integration's helpers by example.
- HTML → Markdown conversion for pages that don't have a markdown source from collections. MDX cleaning for MDX sources.
- `<link rel="alternate">` injection on every HTML page.
- Auto-generated—and customizable!—`llms.txt` and `llms-full.txt`.
- HTTP content negotiation for `text/markdown` in dev and SSR.

## Rationale

There are a number of LLM/`llms.txt`/Markdown-exporting integrations for Astro. Most promise a simple config or even zero-configuration, but are no good for real-world cases.

Some only generate `llms.txt`; not super useful. Some generate markdown, but by converting all HTML automatically—can result in a mess. Some try to use collections for export, but are not flexible enough. 

The top-down approach does not work. We need to go for the bottom-up one. The "correct" approach already exists in Astro: create an endpoint; the same approach used in [`@astrojs/rss`](https://docs.astro.build/en/recipes/rss/). The integration, or Astro's role, is to help you do that by giving examples and helper functions, and automating as much as possible.

astro-slop does exactly that: it gives you enough tooling to create your own simple, short endpoints (`posts.md.ts` next to `posts.astro`) where you can export markdown by yourself; next, it collects that markdown for `llms.txt`, auto-injects `alternate` links and does a ton of other stuff to reduce manual changes.

## Table of contents

- [Features](#features)
- [Install](#install)
- [Configure](#configure)
- [Authoring `.md` endpoints](#authoring-md-endpoints)
- [Customizing `/llms.txt`](#customizing-llmstxt)
- [Customizing `/llms-full.txt`](#customizing-llms-fulltxt)
- [API reference](#api-reference)
- [Examples](#examples)
- [How content negotiation works](#how-content-negotiation-works)
- [How alt-link injection works](#how-alt-link-injection-works)
- [How `/llms.txt` and `/llms-full.txt` are assembled](#how-llmstxt-and-llms-fulltxt-are-assembled)
- [Verify your setup](#verify-your-setup)
- [Caveats](#caveats)
- [Acknowledgements](#acknowledgements)
- [License](#license)


## Features

- **The `md` tagged template** for writing `.md.ts` endpoints. Returns a `Response` with `text/markdown` content-type. Real newlines, no `\n` escapes; arrays auto-join with newlines so a `posts.map(...)` interpolation becomes a bullet list directly; template indentation dedented based on template strings only, so interpolated values aren't affected. Plus inline helpers—`md.link`, `md.heading`, `md.section`—and a `md.string` variant for sub-composition or custom `Response` shapes.
- **Tiny user-facing surface**—one integration call (`slop()`), one tagged template (`md`), one HTML-fallback helper (`fromHtml`), one MDX cleaner (`cleanMdx`), and two "default content" hooks (`defaultLlmsTxt`, `defaultLlmsFullTxt`) for users who want to extend the auto-generated indexes. Six exports, all documented below.
- **`<link rel="alternate" type="text/markdown">`** auto-injected into every HTML page that has a `.md` sibling. Two mutually-exclusive paths so it works across Astro output modes: runtime middleware handles dev / SSR responses, the `astro:build:done` HTML rewriter handles static prerender output. No double-injection, no version-dependent fallback.
- **`cleanMdx(body)`**—strips MDX-specific syntax (top-level `import`/`export` statements, JSX components) from raw collection entry bodies so the result is plain Markdown. HTML is preserved as-is (it's valid Markdown, LLMs parse it fine, and user-written HTML often carries semantic intent). Use it whenever you interpolate `entry.body` into a markdown response — per-entry endpoints, composed pages, anywhere `.mdx` content might leak JSX chrome.
- **`fromHtml(url, options)`**—for static `.astro` pages without a markdown source. Fetches the rendered HTML and runs it through [Defuddle](https://github.com/kepano/defuddle) for main-content extraction, chrome stripping (nav, footer, sidebars, share buttons), and Markdown conversion in a single pass. Lazy-loaded with `@vite-ignore` dynamic imports so Defuddle and its DOM dependency don't appear in your bundle if `fromHtml` is never called.
- **`/llms.txt`** auto-assembled from your `.md` routes per the [llmstxt.org spec](https://llmstxt.org). H1 site name, blockquote summary, then a flat bullet list of every route with title + description—title and description extracted automatically from each endpoint's emitted frontmatter or first H1. Override by writing your own `src/pages/llms.txt.ts` and calling `defaultLlmsTxt(context)` to splice the auto-gen body into your own structure (sections, recommended reading, references, etc.).
- **`/llms-full.txt`**—same site header plus each route's full body content inlined as `### Title\n\n${body}` sections. One document an LLM can ingest end-to-end. Same override pattern via `defaultLlmsFullTxt(context)`.
- **HTTP content negotiation**—when a request's `Accept` header explicitly ranks `text/markdown` above `text/html`, the middleware redirects to the `.md` sibling. RFC 9110-compliant, integration-internal—users add no config. LLM-aware clients (curl scripts, RSS readers, well-behaved crawlers) get markdown automatically; browsers—whose default Accept never lists markdown—keep getting HTML.

## Install

~~~sh
npm install astro-slop
# or: bun add astro-slop
# or: pnpm add astro-slop
~~~

## Configure

~~~js
// astro.config.mjs
import { defineConfig } from "astro/config";
import slop from "astro-slop";

export default defineConfig({
  integrations: [
    // ...
    slop({
      siteName: "Your Site",
      siteDescription: "One-sentence summary used in /llms.txt blockquote.",
    }),
  ],
});
~~~

| Option | Type | Default | Effect |
|---|---|---|---|
| `siteName` | `string` | `"Site"` | H1 of `/llms.txt` and `/llms-full.txt` |
| `siteDescription` | `string` | `undefined` | Blockquote line under the H1 |
| `injectAlternateLink` | `boolean` | `true` | Inject `<link rel="alternate">` into HTML head |
| `llmsFullTxt` | `boolean` | `true` | Generate `/llms-full.txt` |
| `contentNegotiation` | `boolean` | `true` | Redirect HTML→`.md` when `Accept` prefers markdown (request-time only—dev / SSR) |

## Authoring `.md` endpoints

The integration doesn't "auto-generate" markdown content. Instead, it goes for flexibility and custom-fitted approach. 

You write a small `.md.ts` endpoint per page that should have a markdown view, the same way you'd write `rss.xml.ts` for an RSS feed. The integration handles the response wrapper, alt-link injection, and `/llms.txt` indexing.

### Per-entry route (collection-driven)

For dynamic routes backed by a content collection (`[slug].astro`), the markdown sibling re-exports `getStaticPaths` from the HTML page and emits the entry's frontmatter + body. Wrap the body in `cleanMdx()` to strip JSX/imports for `.mdx` collections:

~~~ts
// src/pages/posts/[slug].md.ts
import type { APIRoute } from "astro";
import type { CollectionEntry } from "astro:content";
import { cleanMdx, md } from "astro-slop";

export { getStaticPaths } from "./[slug].astro";

interface Props {
  post: CollectionEntry<"posts">;
}

export const GET: APIRoute<Props> = ({ props }) => md`---
title: ${props.post.data.title}
description: ${props.post.data.description}
---

${cleanMdx(props.post.body ?? "")}`;
~~~

The `getStaticPaths` re-export means the `.md.ts` shares Astro's built path resolution with the HTML page—no duplicate filtering or sorting. Astro's module cache means the underlying `getCollection` query runs once per build.

### Listing route

For listing pages backed by a collection, the `.astro` exports its data; the `.md.ts` imports it:

~~~astro
---
// src/pages/posts/index.astro
import { getCollection } from "astro:content";

export const posts = (await getCollection("posts", ({ data }) => !data.draft))
  .sort((a, b) => /* however you sort */);
---

<Layout>
  {posts.map((p) => <article>{p.data.title}</article>)}
</Layout>
~~~

~~~ts
// src/pages/posts.md.ts
import type { APIRoute } from "astro";
import { md } from "astro-slop";
import { posts } from "./posts/index.astro";

export const GET: APIRoute = () => md`
# Posts

${posts.map((p) =>
  `- ${md.link(p.data.title, `/posts/${p.id}.md`)} — ${p.data.description}`
)}
`;
~~~

The `export` keyword is the only refactor needed—your filter/sort logic stays in the `.astro`, the HTML render reads the same `posts` constant via closure.

### Composed page (homepage with intro + dynamic content, for instance)

~~~astro
---
// src/pages/index.astro
import { getEntry, getCollection } from "astro:content";

export const home = await getEntry("pages", "home");
export const recent = (await getCollection("posts")).slice(0, 5);
---

<Layout>
  <Content>{home!.body}</Content>
  <PostCardList posts={recent} />
</Layout>
~~~

~~~ts
// src/pages/index.md.ts
import type { APIRoute } from "astro";
import { cleanMdx, md } from "astro-slop";
import { home, recent } from "./index.astro";

export const GET: APIRoute = () => md`
${cleanMdx(home!.body)}

## Recent posts

${recent.map((p) =>
  `- ${md.link(p.data.title, `/posts/${p.id}.md`)} — ${p.data.description}`
)}
`;
~~~

`home!.body` is the raw markdown from your collection entry—interpolated as-is, no HTML round-trip. Wrap it in `cleanMdx()` if your homepage is a `.mdx` file with `import` statements or JSX components you don't want in the markdown output (HTML is left alone—valid Markdown, semantic intent preserved). `recent.map(...)` becomes a bullet list because the `md` tag joins arrays with newlines automatically.

### HTML → Markdown for static `.astro` pages without a markdown source

For pages whose content lives in HTML (an `about.astro` with prose mixed into JSX, for example), use `fromHtml`:

~~~ts
// src/pages/about.md.ts
import { fromHtml } from "astro-slop";

export const GET = fromHtml("/about");
~~~

`fromHtml` fetches the HTML at the given URL and runs it through [Defuddle](https://github.com/kepano/defuddle), which detects the main content (stripping nav, footer, sidebars), cleans it up, and emits Markdown. No selector or exclude config needed—Defuddle's heuristics handle the common cases. Pass `defuddleOptions` to forward extra Defuddle settings if you need them.

Works in `astro dev` and SSR modes. For pure static prerender, prefer the source-driven patterns above—HTML → MD round-trip is lossy for code blocks (Shiki) and embedded components.

## Customizing `/llms.txt`

The integration auto-generates `/llms.txt` as a flat bullet list of every `.md` route. To group, reorder, add sections, or replace entirely, write your own endpoint at `src/pages/llms.txt.ts`—when present, the plugin's auto-injection skips and yours wins.

`defaultLlmsTxt(context)` splices the auto-generated body into your wrapping content. Pass the endpoint's `APIContext` so it works in dev and SSR (where it fetches each `.md` route at request time); in static builds it returns a sentinel that the integration's `astro:build:done` hook replaces with the disk-derived body. Simplest case—append a static "About" section:

~~~ts
// src/pages/llms.txt.ts
import type { APIRoute } from "astro";
import { md, defaultLlmsTxt } from "astro-slop";

export const GET: APIRoute = async (context) => {
  const body = md.string`
${await defaultLlmsTxt(context)}

## About this site

Custom site description, hours, contact info, or anything else you want under a top-level heading.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
~~~

`md.string` is the variant of the `md` tag that returns a string instead of a `Response`—useful when you need to construct the `Response` yourself (here, with `text/plain` for the `.txt` extension).

If you want the extra section sourced from a content collection (e.g., a list of recommended external resources), the same pattern works—load the collection inside the handler:

~~~ts
// src/pages/llms.txt.ts
import type { APIRoute } from "astro";
import { md, defaultLlmsTxt } from "astro-slop";
import { getCollection } from "astro:content";

export const GET: APIRoute = async (context) => {
  const links = await getCollection("links");

  const body = md.string`
${await defaultLlmsTxt(context)}

## Recommended reading

${links.map((l) => `- ${md.link(l.data.title, l.data.url)} — ${l.data.summary}`)}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
~~~

## Customizing `/llms-full.txt`

`/llms-full.txt` reuses `/llms.txt`'s site header (`# Site` plus the `> description` blockquote) and then **inlines every route's full body content** as a flat list of `### Title` sections instead of bullet links. Same source data, different density.

~~~
# My Site

> Site description

### Welcome to My Site

[full body of /index.md, frontmatter stripped]

### About

[full body of /about.md]

### My First Entry

[full body of /entries/first-entry.md]

### Hello, World

[full body of /entries/hello-world.md]
~~~

Override by writing `src/pages/llms-full.txt.ts`:

~~~ts
// src/pages/llms-full.txt.ts
import type { APIRoute } from "astro";
import { defaultLlmsFullTxt } from "astro-slop";

export const GET: APIRoute = async (context) => {
  const body = await defaultLlmsFullTxt(context);
  return new Response(`${body}\n## Notes\n\nExtra context here.\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
~~~

Each section uses an `###` heading with the route's title (frontmatter `title:` or first H1) followed by the body with leading frontmatter stripped—so titles aren't repeated and the document reads top-to-bottom.

## API reference

~~~ts
import {
  default as slop,        // the integration
  md,                     // tagged template, returns Response
  fromHtml,               // HTML → Markdown helper, returns GET handler
  cleanMdx,               // strip MDX-specific syntax from a body string
  defaultLlmsTxt,         // returns auto-gen llms.txt body as string
  defaultLlmsFullTxt,     // returns auto-gen llms-full.txt body as string
} from "astro-slop";
~~~

### The `md` tag

Tagged template that returns a `Response` with `Content-Type: text/markdown; charset=utf-8`.

~~~ts
md`# Hello`
// → Response { body: "# Hello\n", headers: { "Content-Type": "text/markdown; charset=utf-8" } }
~~~

**Behavior:**
- Real newlines work—no `\n` escapes needed
- Arrays in interpolation are joined with `\n` automatically
- Leading whitespace from template indentation is dedented (computed from template strings only—interpolated values aren't affected)
- Output has `\n`-terminated lines and a single trailing newline

~~~ts
const items = ["- a", "- b", "- c"];

md`
  # Heading

  ${items}
`
// → Response with body:
// "# Heading\n\n- a\n- b\n- c\n"
~~~

### `md.string`

Same template behavior as `md`, returns a `string` instead of a `Response`. Use for sub-composition or when you need a custom `Response` shape (e.g., `text/plain` for `.txt` URLs):

~~~ts
const intro = md.string`
  # Intro

  Welcome.
`;

const fullDoc = md.string`
  ${intro}

  ## Section 2

  More content.
`;

return new Response(fullDoc, { headers: { "Content-Type": "text/plain" } });
~~~

### Inline helpers

These return `string`s—call them inside template interpolations:

| Helper | Returns | Example |
|---|---|---|
| `md.link(text, url)` | `[text](url)` with `[`/`]` in `text` escaped | `md.link("Hello [world]", "/foo")` → `"[Hello \\[world\\]](/foo)"` |
| `md.heading(depth, text)` | Markdown heading | `md.heading(2, "Posts")` → `"## Posts"` |
| `md.section(heading, body)` | `${heading}\n\n${body}` | `md.section("## Section", "- a")` → `"## Section\n\n- a"` |

### `fromHtml(url, options)`

Returns an Astro `GET` handler that fetches HTML from `url` and runs it through [Defuddle](https://github.com/kepano/defuddle) for content extraction + Markdown conversion in one pass.

~~~ts
fromHtml("/about");

// Optionally forward extra options to Defuddle:
fromHtml("/about", {
  defuddleOptions: { /* ... */ },
});
~~~

| Option | Type | Default | Effect |
|---|---|---|---|
| `defuddleOptions` | object | `undefined` | Pass-through to Defuddle. Whatever you set is merged with a forced `markdown: true` (the integration always emits markdown — your `markdown: false` is ignored). See [Defuddle's options](https://github.com/kepano/defuddle) for the full set. |

Defuddle handles main-content detection (`<main>` / `<article>` / smart fallbacks) and chrome removal automatically—no `selector` or `exclude` knobs to tune. The integration lazy-loads Defuddle and `linkedom` (its DOM dependency) on first request so they don't appear in the bundle if `fromHtml` is never called.

### `cleanMdx(body)`

Strips MDX-specific syntax from a content collection entry's raw body, so the result is plain Markdown suitable for `.md` output.

What gets stripped:
- Top-level `import` and `export` statements
- Self-closing JSX components: `<Component prop="..." />`
- Paired JSX components: `<Component>...content...</Component>`—content kept

What's preserved:
- All HTML—valid in Markdown, LLMs handle it, often carries semantic intent (`<address>`, `<time>`, `<cite>`, etc.). If you want HTML scrubbed, run a separate sanitizer pass.
- All actual prose, lists, code blocks, links, emphasis

~~~ts
import { cleanMdx } from "astro-slop";

const cleaned = cleanMdx(`
import Note from '../components/Note.astro';

# Title

<Note type="tip">Just a tip.</Note>

<span class="badge">Featured</span> introduction here.
`);
// → "# Title\n\nJust a tip.\n\n<span class=\"badge\">Featured</span> introduction here.\n"
~~~

The `<span>` is preserved (HTML is valid Markdown). The MDX `import` is stripped, and the `<Note>` JSX component is unwrapped to keep its content.

Use it on `entry.body` for collection entries that may use MDX:

~~~ts
md`...${cleanMdx(entry.body ?? "")}`
~~~

### `defaultLlmsTxt(context?: APIContext): Promise<string>`

Returns the auto-generated `/llms.txt` body. Use inside a custom `src/pages/llms.txt.ts` to extend.

- **Live request (dev / SSR):** fetches each `.md` route over HTTP using `context.request.url` as the base, crawls response bodies for links to per-entry siblings, and returns the assembled body. Pass `context` from your endpoint to get this path.
- **Static prerender, or no `context`:** returns a sentinel string. The integration's `astro:build:done` hook reads `dist/llms.txt`, `replaceAll`s the sentinel with the disk-walked auto-gen body, and writes it back. Your wrapping content (custom sections, etc.) is preserved; the auto-gen content lands in place of the sentinel.

### `defaultLlmsFullTxt(context?: APIContext): Promise<string>`

Returns the auto-generated `/llms-full.txt` body—site header followed by each route's full content inlined as `### Title\n\n${body}` sections. Same prerender / runtime split as `defaultLlmsTxt`; pass `context` from your endpoint.

## Examples

### Collection-backed routes

A common case: a content collection of `.md`/`.mdx` files (the example uses `posts`, but any name works), plus a listing page and per-entry detail pages. Two endpoint files cover both.

**`src/pages/posts/index.astro`**—the listing. Hoist the `posts` array to `export const` so the `.md.ts` sibling can import it:

~~~astro
---
import { getCollection } from "astro:content";

export const posts = (await getCollection("posts"))
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---

<html>
  <body>
    <h1>Posts</h1>
    <ul>
      {posts.map((p) => <li><a href={`/posts/${p.id}`}>{p.data.title}</a></li>)}
    </ul>
  </body>
</html>
~~~

**`src/pages/posts/index.md.ts`**—the listing's markdown sibling:

~~~ts
import type { APIRoute } from "astro";
import { md } from "astro-slop";
import { posts } from "./index.astro";

export const GET: APIRoute = () => md`
# Posts

${posts.map((p) => `- ${md.link(p.data.title, `/posts/${p.id}.md`)} — ${p.data.description}`)}
`;
~~~

**`src/pages/posts/[slug].md.ts`**—per-post markdown. Re-export `getStaticPaths` from the HTML page so both routes resolve from the same source:

~~~ts
import type { APIRoute } from "astro";
import type { CollectionEntry } from "astro:content";
import { cleanMdx, md } from "astro-slop";

export { getStaticPaths } from "./[slug].astro";

export const GET: APIRoute<{ post: CollectionEntry<"posts"> }> = ({ props }) =>
  md`---
title: ${props.post.data.title}
description: ${props.post.data.description}
---

${cleanMdx(props.post.body ?? "")}`;
~~~

`/llms.txt` and `/llms-full.txt` are auto-generated from these endpoints. `<link rel="alternate" type="text/markdown">` is auto-injected into `/posts` and every `/posts/<slug>` HTML page.

### Single page from a markdown collection

A single page sourced from one entry in a content collection (e.g., a `pages` collection containing `home.md`, `about.md`, etc.). The `.astro` page renders the entry's content; the `.md.ts` sibling emits the raw body.

**`src/pages/about.astro`**—exports the entry so the sibling can read its body:

~~~astro
---
import { getEntry, render } from "astro:content";

export const aboutEntry = await getEntry("pages", "about");
const { Content } = await render(aboutEntry!);
---

<html>
  <body>
    <Content />
  </body>
</html>
~~~

**`src/pages/about.md.ts`**—interpolates the raw body, runs through `cleanMdx` to strip MDX/styling tags:

~~~ts
import type { APIRoute } from "astro";
import { cleanMdx, md } from "astro-slop";
import { aboutEntry } from "./about.astro";

export const GET: APIRoute = () => md`${cleanMdx(aboutEntry!.body ?? "")}`;
~~~

That's a single `.md` route at `/about.md`. The integration auto-injects the alt-link and includes the page in `/llms.txt`.

### Single HTML page that needs conversion

For pages whose content is hard-coded into JSX in an `.astro` file (no markdown source available), use `fromHtml` to fetch the rendered HTML and convert via Defuddle:

**`src/pages/contact.astro`** (illustrative—typical handwritten page with prose mixed into JSX):

~~~astro
---
const email = "hello@example.com";
---

<html>
  <body>
    <main>
      <h1>Contact</h1>
      <p>Reach out at <a href={`mailto:${email}`}>{email}</a>.</p>
      <p>Office hours: Mon-Fri 9-5 PT.</p>
    </main>
  </body>
</html>
~~~

**`src/pages/contact.md.ts`**—one line:

~~~ts
import { fromHtml } from "astro-slop";

export const GET = fromHtml("/contact");
~~~

`fromHtml` fetches `/contact`, runs Defuddle (main-content extraction + chrome stripping + Markdown conversion), and returns the result. The integration handles routing, alt-link injection, and `/llms.txt` inclusion automatically.

Mix and match freely: use the `md` tag for collection-backed routes (lossless, source-driven) and `fromHtml` for static `.astro` content (HTML→MD via Defuddle). The integration's manifest treats them uniformly—alt-links and `/llms.txt` entries work the same regardless of which shape produced the `.md` URL.

### Customizing `/llms.txt`

The auto-generated `/llms.txt` is a good default. To extend it (or replace it entirely), write your own endpoint at `src/pages/llms.txt.ts`—Astro's routing prefers user-defined files over integration-injected ones, so yours wins.

Append a static "About this site" section to the auto-gen:

~~~ts
// src/pages/llms.txt.ts
import type { APIRoute } from "astro";
import { md, defaultLlmsTxt } from "astro-slop";

export const GET: APIRoute = async (context) => {
  const body = md.string`
${await defaultLlmsTxt(context)}

## About this site

Custom site description, hours, contact info, or whatever else you want under a top-level heading.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
~~~

Or pull the extra section from a content collection—useful for adding curated external links the integration can't auto-discover:

~~~ts
// src/pages/llms.txt.ts
import type { APIRoute } from "astro";
import { md, defaultLlmsTxt } from "astro-slop";
import { getCollection } from "astro:content";

export const GET: APIRoute = async (context) => {
  const links = await getCollection("links");

  const body = md.string`
${await defaultLlmsTxt(context)}

## Recommended reading

${links.map((l) => `- ${md.link(l.data.title, l.data.url)} — ${l.data.summary}`)}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
~~~

### Customizing `/llms-full.txt`

Same pattern as `/llms.txt`. Write `src/pages/llms-full.txt.ts` and call `defaultLlmsFullTxt(context)` to wrap or extend.

Append a static "Notes for AI agents" section:

~~~ts
// src/pages/llms-full.txt.ts
import type { APIRoute } from "astro";
import { defaultLlmsFullTxt } from "astro-slop";

export const GET: APIRoute = async (context) => {
  const body = await defaultLlmsFullTxt(context);
  return new Response(
    `${body}\n## Notes for agents\n\nThis content is licensed CC BY 4.0. Attribution: https://example.com.\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
};
~~~

Or pre-process the auto-gen—e.g., add a license preamble at the top:

~~~ts
// src/pages/llms-full.txt.ts
import type { APIRoute } from "astro";
import { defaultLlmsFullTxt } from "astro-slop";

export const GET: APIRoute = async (context) => {
  const preamble = `<!--\nThis document is licensed CC BY 4.0.\nGenerated ${new Date().toISOString()}.\n-->\n\n`;
  const body = await defaultLlmsFullTxt(context);

  return new Response(preamble + body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
~~~

## How content negotiation works

When a request comes in to a route that has a `.md` sibling, the middleware checks the request's `Accept` header. If `text/markdown` (or `text/x-markdown`) is ranked strictly higher than `text/html`, the middleware returns a `302` redirect to the `.md` sibling.

~~~
GET /posts/hello-world
Accept: text/markdown

→ 302 Location: /posts/hello-world.md
~~~

Browsers never trigger this—their default `Accept` is `text/html, application/xhtml+xml, ..., */*` with no markdown listed, so HTML always wins. Clients that explicitly request markdown (curl scripts, RSS readers, well-behaved LLM crawlers) get redirected automatically.

The redirect carries a `Vary: Accept` header so downstream caches (Cloudflare, Vercel edge, nginx, etc.) treat it as Accept-conditional. Without `Vary`, a CDN could serve a redirect cached for an HTML-preferring client to a markdown-preferring one (or vice versa).

Test it locally with `bun run dev`:

~~~sh
curl -L -H "Accept: text/markdown" http://localhost:4321/posts/hello-world
# ↑ -L follows the 302; you get the .md content
~~~

~~~sh
curl http://localhost:4321/posts/hello-world
# ↑ default Accept; you get HTML as before
~~~

**Important limitation:** content negotiation only works at request time—`astro dev` and SSR mode. Static prerender bakes one file per URL into `dist/`, and the deployed file server has no awareness of `Accept`. Static-mode users would configure server-level negotiation (Apache `mod_negotiation`, nginx `try_files` + `Accept` matching, Cloudflare Workers, etc.) themselves; the integration can't substitute for that.

To disable: `slop({ contentNegotiation: false })`.

## How alt-link injection works

The integration handles `<link rel="alternate" type="text/markdown">` injection through two complementary paths, one per execution context:

1. **Runtime middleware**—registered via `addMiddleware` in `astro:config:setup`, fires on every dev/SSR response. The middleware skips prerendered routes entirely (those have no live request and would just trigger a `headers` access warning). For HTML responses with a registered `.md` sibling, it injects the `<link>` tag before `</head>`.

2. **Build-time HTML rewriting**—runs in `astro:build:done`, walks the emitted `dist/**/*.html` files, derives each one's URL pathname back from its file path, looks up the manifest, and injects the link tag inline. Handles all static prerender output.

The two paths are mutually exclusive: middleware handles request-time output, build:done handles prerender output. There's no overlap, no double-injection.

Both paths share the same insertion logic (in `src/alt-link.ts`)—same regex for finding the `</head>` tag, same already-injected detection, same tag format. The duplication of *execution context* (request-time vs. build-time) doesn't translate into duplicated *logic*.

The route manifest is built in `astro:routes:resolved` from Astro's resolved route table—every project route ending in `.md` becomes a manifest entry paired with its HTML sibling URL pattern. Static and dynamic patterns are handled identically.

To disable: `slop({ injectAlternateLink: false })`.

## How `/llms.txt` and `/llms-full.txt` are assembled

Two paths produce the same logical output from different sources:

**Static build** — at `astro:build:done`, the integration walks `dist/*.md`, matches each file to a route in the manifest, parses title (frontmatter `title:` or first H1) and description (frontmatter `description:`), strips frontmatter from the body, and writes `dist/llms.txt` and `dist/llms-full.txt`. If the user's `src/pages/llms.txt.ts` produced a sentinel-bearing file at prerender, the build:done hook splices the auto-gen body in place of the sentinel — preserving the user's wrapping content.

**Dev / SSR** — at request time, the injected `/llms.txt` and `/llms-full.txt` route handlers fetch every static `.md` route over HTTP using the incoming request's URL as the base, then crawl response bodies for markdown links (`[…](/foo.md)`) that match per-entry patterns from the manifest, recursively fetching those. Per-entry routes that aren't linked from any static parent listing won't be enumerated at request time (they still appear in static builds, since the disk walk doesn't depend on link structure).

`/llms.txt` formats each record as a `- [title](mdUrl) — description` bullet, in URL-sorted order.
`/llms-full.txt` formats each record as a `### title\n\n${body}` section, in URL-sorted order, with frontmatter stripped from the body.

Auto-gen output is a single flat list — no `## Pages` / `## Posts` bucketing. To group, reorder, or add custom sections, write your own `src/pages/llms.txt.ts` and arrange your output around `defaultLlmsTxt(context)`.

## Verify your setup

Two third-party tools are useful for sanity-checking that your site exposes markdown the way LLM-aware clients expect:

- **[acceptmarkdown.com](https://acceptmarkdown.com/)**—sends a request with `Accept: text/markdown` and checks that your site responds with markdown (via content negotiation or the `.md` sibling).
- **[isitagentready.com](https://isitagentready.com/)**—broader audit: checks for `/llms.txt`, `<link rel="alternate" type="text/markdown">` injection, content negotiation, and other agent-readiness signals.
- **[contentsignals.org](https://contentsignals.org/)**—content-signals standard for declaring how your content can be used by AI agents and crawlers; useful complement to the structural checks above.

Run your site through both after deploying. With `astro-slop` configured per this README, you should pass cleanly: `/llms.txt` is auto-generated, `<link rel="alternate">` is injected on every HTML page that has a `.md` sibling, and content negotiation redirects markdown-preferring clients automatically.

## Caveats

- **`fromHtml` in static prerender**: Pre-rendering may run before the corresponding HTML file exists, so `fromHtml` can fail for purely static builds. Use `astro dev` to verify, or rely on the `md` tag's source-driven patterns above.
- **`.mdx` raw bodies**: `entry.body` for `.mdx` collection entries is the raw source—including `import` statements and JSX components like `<Note>` or `<Hero />`. Wrap it in `cleanMdx()` whenever you interpolate `entry.body` into a markdown response (per-entry endpoints AND composed pages like a homepage). Without it, the LLM sees raw MDX syntax alongside the content.
- **HTML is preserved**: `cleanMdx` deliberately leaves HTML alone. HTML is valid Markdown, LLMs handle it, and user-written HTML often carries semantic intent (`<address>`, `<time>`, `<cite>`). If you want HTML scrubbed, run a separate sanitizer pass after `cleanMdx`.
- **MDX cleanup is regex-based**: `cleanMdx` handles common cases (top-level imports/exports, simple JSX components) but isn't a full MDX parser. For complex MDX (nested JSX expressions, fragments, conditional rendering), inspect the output and extend if needed.
- **Override detection extensions**: the integration checks `.ts`, `.js`, `.mts`, `.mjs`, and `.astro` for user override files at `src/pages/llms.txt.*` and `src/pages/llms-full.txt.*`. Other extensions aren't checked—the integration's auto-gen will collide and Astro will emit a warning.
- **`md.link` escape coverage**: only escapes `[` and `]` in link text. Most other markdown-special chars don't break links—but if your link text contains parentheses, ampersands, or HTML entities and you need strict correctness, post-process or write the link by hand.
- **State sharing**: the integration shares state across module realms via `globalThis[Symbol.for("astro-slop:state")]`. This works for single-process Astro builds (the standard case). Multi-process setups (workers, custom isolation) may need a different mechanism—file an issue if you hit this.
- **Per-entry route enumeration in dev / SSR**: at request time, the injected `/llms.txt` and `/llms-full.txt` handlers fetch every static `.md` route and crawl response bodies for `[…](/foo.md)` links to discover dynamic per-entry routes. A per-entry route that isn't linked from any static parent listing won't be enumerated in dev / SSR responses (it still appears in static builds, since the disk walk doesn't depend on link structure). The README's listing-route pattern (`/posts.md` linking each `/posts/<slug>.md`) is the canonical way to make per-entry routes discoverable.

## Acknowledgements

Thanks to [Steph Ango](https://github.com/kepano) for [Defuddle](https://github.com/kepano/defuddle), the library `fromHtml` uses for content extraction and HTML → Markdown conversion.

## License

MIT

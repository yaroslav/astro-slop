## [Unreleased]

## [0.1.3] - 2026-05-09

- Added logging: how many alternate links were injected, how many markdown files were created, llms.txt and llms-full.txt creation.

## [0.1.2] - 2026-05-09

No user-facing changes

## [0.1.1] - 2026-05-09

- `/llms.txt` and `/llms-full.txt` no longer end up with empty sections in real projects. The previous capture path used Node's raw `import()` to pull each `.md.ts` endpoint into the integration and call its `GET()`; this failed for any endpoint that imported `.astro` files, bare relative paths, or `astro:content` virtual modules (essentially every realistic endpoint), and the failures were silently swallowed.

- Auto-generation now consumes framework artifacts instead of re-executing user code:
  - **Static build:** the `astro:build:done` hook walks `dist/*.md`, parses metadata, and writes `dist/llms.txt` and `dist/llms-full.txt` directly.
  - **Dev / SSR:** the injected `/llms.txt` and `/llms-full.txt` route handlers fetch each static `.md` route over HTTP and crawl response bodies for markdown links to enumerate per-entry routes. Per-entry routes that aren't linked from any static parent listing won't be enumerated at request time (they still appear in static builds).

- Auto-generated output is now a single flat bullet list (and `### title` section list for `/llms-full.txt`). The previous `## Pages` / `## Posts` bucketing baked in a blog-shaped assumption; users who want grouped sections should write their own `src/pages/llms.txt.ts` and add the headings they want around `defaultLlmsTxt(context)`.

## [0.1.0] - 2026-05-09

- Initial release. 
- Exposes pages as `.md` siblings, auto-generates `/llms.txt` and `/llms-full.txt` indexes per the [llmstxt.org](https://llmstxt.org) spec, injects `<link rel="alternate" type="text/markdown">` into every HTML page that has a markdown counterpart, and handles HTTP content negotiation (clients sending `Accept: text/markdown` get redirected to the `.md` sibling).
- Authoring helpers: the `md` tagged template for writing `.md.ts` endpoints, `cleanMdx` for stripping MDX-specific syntax from raw collection bodies, `fromHtml` for HTML→Markdown conversion of static `.astro` pages (via Defuddle), and `defaultLlmsTxt` / `defaultLlmsFullTxt` for extending the auto-generated indexes from a custom user endpoint.

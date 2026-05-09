## [Unreleased]

## [0.1.0] - 2026-05-09

- Initial release. 
- Exposes pages as `.md` siblings, auto-generates `/llms.txt` and `/llms-full.txt` indexes per the [llmstxt.org](https://llmstxt.org) spec, injects `<link rel="alternate" type="text/markdown">` into every HTML page that has a markdown counterpart, and handles HTTP content negotiation (clients sending `Accept: text/markdown` get redirected to the `.md` sibling).
- Authoring helpers: the `md` tagged template for writing `.md.ts` endpoints, `cleanMdx` for stripping MDX-specific syntax from raw collection bodies, `fromHtml` for HTML→Markdown conversion of static `.astro` pages (via Defuddle), and `defaultLlmsTxt` / `defaultLlmsFullTxt` for extending the auto-generated indexes from a custom user endpoint.

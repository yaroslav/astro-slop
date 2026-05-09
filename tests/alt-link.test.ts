import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { injectAlternateLink } from "../src/alt-link.ts";

const ALT_LINK_RE = /<link rel="alternate" type="text\/markdown"/;

describe("injectAlternateLink", () => {
  test("inserts link tag immediately before </head>", () => {
    const html = `<html><head><title>X</title></head><body></body></html>`;
    const result = injectAlternateLink(html, "/foo.md");
    assert.ok(result, "expected a modified string");
    assert.match(
      result,
      /<link rel="alternate" type="text\/markdown" href="\/foo.md">/,
    );
    const linkPos = result.search(ALT_LINK_RE);
    const closePos = result.indexOf("</head>");
    assert.ok(linkPos < closePos, "link must precede </head>");
  });

  test("returns null when no </head> is present", () => {
    const html = `<html><body></body></html>`;
    assert.equal(injectAlternateLink(html, "/foo.md"), null);
  });

  test("returns null when an alternate-markdown link is already present", () => {
    const html = `<html><head><link rel="alternate" type="text/markdown" href="/already.md"></head></html>`;
    assert.equal(injectAlternateLink(html, "/foo.md"), null);
  });

  test("matches </head> case-insensitively", () => {
    const html = `<html><HEAD></HEAD><body></body></html>`;
    const result = injectAlternateLink(html, "/foo.md");
    assert.ok(result);
    assert.match(result, ALT_LINK_RE);
  });

  test("only inserts once even when </head> appears multiple times", () => {
    const html = `<html><head></head><script>const s = "</head>";</script></html>`;
    const result = injectAlternateLink(html, "/foo.md");
    assert.ok(result);
    const matches = result.match(/<link rel="alternate"/g) ?? [];
    assert.equal(matches.length, 1);
  });

  test("preserves other content untouched", () => {
    const html = `<html><head><title>Hi</title><meta charset="utf-8"></head><body><h1>Hi</h1></body></html>`;
    const result = injectAlternateLink(html, "/x.md");
    assert.ok(result);
    assert.match(result, /<title>Hi<\/title>/);
    assert.match(result, /<meta charset="utf-8">/);
    assert.match(result, /<h1>Hi<\/h1>/);
  });

  test("uses the passed mdUrl as href verbatim", () => {
    const html = `<html><head></head></html>`;
    const result = injectAlternateLink(html, "/posts/hello-world.md");
    assert.ok(result);
    assert.match(result, /href="\/posts\/hello-world\.md"/);
  });
});

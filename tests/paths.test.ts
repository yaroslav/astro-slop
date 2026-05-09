import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { htmlFileToUrlPath, substituteParams } from "../src/paths.ts";

// htmlFileToUrlPath uses node:path's `sep` for input splitting; on POSIX
// runners that's "/", so backslash inputs aren't normalized in tests run
// here. The cases below exercise POSIX-style relative paths, which is what
// `relative()` returns during a build on the same platform.

describe("htmlFileToUrlPath", () => {
  test("'index.html' maps to '/'", () => {
    assert.equal(htmlFileToUrlPath("index.html"), "/");
  });

  test("'foo/index.html' maps to '/foo'", () => {
    assert.equal(htmlFileToUrlPath("foo/index.html"), "/foo");
  });

  test("'foo.html' maps to '/foo'", () => {
    assert.equal(htmlFileToUrlPath("foo.html"), "/foo");
  });

  test("nested 'foo/bar.html' maps to '/foo/bar'", () => {
    assert.equal(htmlFileToUrlPath("foo/bar.html"), "/foo/bar");
  });

  test("nested 'foo/bar/index.html' maps to '/foo/bar'", () => {
    assert.equal(htmlFileToUrlPath("foo/bar/index.html"), "/foo/bar");
  });

  test("non-html paths fall through with a leading slash", () => {
    assert.equal(htmlFileToUrlPath("foo.txt"), "/foo.txt");
  });
});

describe("substituteParams", () => {
  test("substitutes a single [name] segment", () => {
    assert.equal(
      substituteParams("/posts/[slug].md", { slug: "hello-world" }),
      "/posts/hello-world.md",
    );
  });

  test("substitutes [...rest] segments preserving inner slashes", () => {
    assert.equal(
      substituteParams("/[...path].md", { path: "foo/bar/baz" }),
      "/foo/bar/baz.md",
    );
  });

  test("substitutes multiple distinct params", () => {
    assert.equal(
      substituteParams("/[year]/[slug].md", {
        year: "2025",
        slug: "hello",
      }),
      "/2025/hello.md",
    );
  });

  test("returns the pattern unchanged when no params match", () => {
    assert.equal(
      substituteParams("/static/page.md", { slug: "ignored" }),
      "/static/page.md",
    );
  });

  test("ignores extra params not present in the pattern", () => {
    assert.equal(
      substituteParams("/posts/[slug].md", { slug: "x", year: "2025" }),
      "/posts/x.md",
    );
  });

  test("treats [...slug] and [slug] independently in the same pattern", () => {
    assert.equal(
      substituteParams("/[...slug].md", { slug: "a/b" }),
      "/a/b.md",
    );
  });
});

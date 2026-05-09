import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { htmlFileToUrlPath, mdFileToUrlPath } from "../src/paths.ts";

// htmlFileToUrlPath / mdFileToUrlPath use node:path's `sep` for input
// splitting; on POSIX runners that's "/", so backslash inputs aren't
// normalized in tests run here. The cases below exercise POSIX-style
// relative paths, which is what `relative()` returns during a build on
// the same platform.

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

describe("mdFileToUrlPath", () => {
  test("'index.md' maps to '/index.md' (literal, no index folding)", () => {
    assert.equal(mdFileToUrlPath("index.md"), "/index.md");
  });

  test("'posts.md' maps to '/posts.md'", () => {
    assert.equal(mdFileToUrlPath("posts.md"), "/posts.md");
  });

  test("nested 'posts/hello-world.md' maps to '/posts/hello-world.md'", () => {
    assert.equal(
      mdFileToUrlPath("posts/hello-world.md"),
      "/posts/hello-world.md",
    );
  });

  test("'posts/index.md' maps to '/posts/index.md' (no folding)", () => {
    assert.equal(mdFileToUrlPath("posts/index.md"), "/posts/index.md");
  });
});

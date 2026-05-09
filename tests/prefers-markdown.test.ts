import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prefersMarkdown } from "../src/prefers-markdown.ts";

describe("prefersMarkdown", () => {
  test("returns false for null Accept header", () => {
    assert.equal(prefersMarkdown(null), false);
  });

  test("returns false for empty Accept header", () => {
    assert.equal(prefersMarkdown(""), false);
  });

  test("returns true when only text/markdown is listed", () => {
    assert.equal(prefersMarkdown("text/markdown"), true);
  });

  test("returns true when only text/x-markdown is listed", () => {
    assert.equal(prefersMarkdown("text/x-markdown"), true);
  });

  test("returns false when only text/html is listed", () => {
    assert.equal(prefersMarkdown("text/html"), false);
  });

  test("returns false when only wildcard is listed", () => {
    assert.equal(prefersMarkdown("*/*"), false);
  });

  test("returns false on tie (both q=1 by default)", () => {
    assert.equal(
      prefersMarkdown("text/markdown, text/html"),
      false,
    );
  });

  test("returns true when markdown q is strictly higher", () => {
    assert.equal(
      prefersMarkdown("text/markdown;q=1, text/html;q=0.9"),
      true,
    );
  });

  test("returns false when html q is higher", () => {
    assert.equal(
      prefersMarkdown("text/markdown;q=0.5, text/html;q=0.9"),
      false,
    );
  });

  test("ignores wildcard when comparing exact types", () => {
    // Browser-typical Accept: */* doesn't elevate markdown above HTML
    assert.equal(
      prefersMarkdown(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ),
      false,
    );
  });

  test("uses higher of text/markdown vs text/x-markdown", () => {
    assert.equal(
      prefersMarkdown("text/markdown;q=0.5, text/x-markdown;q=1, text/html;q=0.9"),
      true,
    );
  });
});

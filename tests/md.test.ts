import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { md } from "../src/md.ts";

describe("md tag", () => {
  test("returns a Response with text/markdown content-type", async () => {
    const response = md`# Hello`;
    assert.ok(response instanceof Response);
    assert.equal(
      response.headers.get("Content-Type"),
      "text/markdown; charset=utf-8",
    );
    assert.equal(await response.text(), "# Hello\n");
  });

  test("preserves real newlines in template", async () => {
    const response = md`# Title

Body paragraph.`;
    assert.equal(await response.text(), "# Title\n\nBody paragraph.\n");
  });

  test("auto-joins arrays in interpolations with newlines", async () => {
    const items = ["- a", "- b", "- c"];
    const response = md`# Heading

${items}`;
    assert.equal(
      await response.text(),
      "# Heading\n\n- a\n- b\n- c\n",
    );
  });

  test("dedents based on template indentation, not interpolations", async () => {
    const items = ["- a", "- b"];
    const response = md`
      # Heading

      ${items}
    `;
    assert.equal(await response.text(), "# Heading\n\n- a\n- b\n");
  });

  test("flush-left template emits flush-left output", async () => {
    const response = md`# Flush

No indent here.`;
    assert.equal(await response.text(), "# Flush\n\nNo indent here.\n");
  });

  test("drops null and undefined interpolation values", async () => {
    const response = md`Before${null}middle${undefined}after`;
    assert.equal(await response.text(), "Beforemiddleafter\n");
  });

  test("interpolates numbers and booleans as strings", async () => {
    const response = md`Count: ${42}, flag: ${true}`;
    assert.equal(await response.text(), "Count: 42, flag: true\n");
  });

  test("output ends with exactly one trailing newline", async () => {
    const response = md`# A



`;
    const body = await response.text();
    assert.ok(body.endsWith("\n"));
    assert.ok(!body.endsWith("\n\n"));
  });
});

describe("md.string", () => {
  test("returns a string instead of Response", () => {
    const result = md.string`# Hello`;
    assert.equal(typeof result, "string");
    assert.equal(result, "# Hello\n");
  });

  test("respects same template semantics as md tag", () => {
    const items = ["one", "two"];
    const result = md.string`${items}`;
    assert.equal(result, "one\ntwo\n");
  });
});

describe("md.link", () => {
  test("formats markdown link", () => {
    assert.equal(md.link("Hello", "/path"), "[Hello](/path)");
  });

  test("escapes [ and ] in link text", () => {
    assert.equal(
      md.link("Hello [world]", "/foo"),
      "[Hello \\[world\\]](/foo)",
    );
  });
});

describe("md.heading", () => {
  test("creates heading at given depth", () => {
    assert.equal(md.heading(1, "Title"), "# Title");
    assert.equal(md.heading(3, "Sub"), "### Sub");
  });
});

describe("md.section", () => {
  test("joins heading and body with blank line", () => {
    assert.equal(
      md.section("## Heading", "Body line."),
      "## Heading\n\nBody line.",
    );
  });
});

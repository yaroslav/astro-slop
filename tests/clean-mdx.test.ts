import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cleanMdx } from "../src/clean-mdx.ts";

describe("cleanMdx", () => {
  test("returns empty string for empty input", () => {
    assert.equal(cleanMdx(""), "");
  });

  test("strips top-level import statements", () => {
    const input = `import Note from "../components/Note.astro";

# Title

Body.`;
    assert.equal(cleanMdx(input), "# Title\n\nBody.\n");
  });

  test("strips top-level export statements", () => {
    const input = `export const meta = { foo: 1 };

# Title

Body.`;
    assert.equal(cleanMdx(input), "# Title\n\nBody.\n");
  });

  test("strips self-closing JSX components entirely", () => {
    const input = `# Title

<Hero size="large" />

After.`;
    assert.equal(cleanMdx(input), "# Title\n\nAfter.\n");
  });

  test("unwraps paired JSX components, keeping their content", () => {
    const input = `# Title

<Note type="tip">Just a tip.</Note>

After.`;
    assert.equal(
      cleanMdx(input),
      "# Title\n\nJust a tip.\n\nAfter.\n",
    );
  });

  test("preserves HTML tags as-is", () => {
    const input = `<span class="badge">Featured</span> intro.

<address>123 Main St</address>`;
    assert.equal(
      cleanMdx(input),
      `<span class="badge">Featured</span> intro.\n\n<address>123 Main St</address>\n`,
    );
  });

  test("preserves markdown formatting (emphasis, code, links)", () => {
    const input = `Some _emphasis_, **importance**, and \`code\`.

[A link](https://example.com).`;
    assert.equal(
      cleanMdx(input),
      "Some _emphasis_, **importance**, and `code`.\n\n[A link](https://example.com).\n",
    );
  });

  test("collapses 3+ consecutive blank lines to one", () => {
    const input = `Line one.




Line two.`;
    assert.equal(cleanMdx(input), "Line one.\n\nLine two.\n");
  });

  test("handles nested JSX components via two-pass unwrap", () => {
    const input = `<Outer><Inner>content</Inner></Outer>`;
    assert.equal(cleanMdx(input), "content\n");
  });

  test("strips multi-line import statements", () => {
    const input = `import {
  Note,
  Hero,
} from "../components";

# Title

Body.`;
    assert.equal(cleanMdx(input), "# Title\n\nBody.\n");
  });

  test("strips multi-line export statements with object body", () => {
    const input = `export const config = {
  foo: 1,
  bar: 2,
};

# Title

Body.`;
    assert.equal(cleanMdx(input), "# Title\n\nBody.\n");
  });

  test("strips multiple top-level imports and exports together", () => {
    const input = `import A from "a";
import B from "b";
export const meta = { title: "x" };

# Title`;
    assert.equal(cleanMdx(input), "# Title\n");
  });

  test("strips re-export with brace block", () => {
    const input = `export { foo, bar } from "./other";

Body.`;
    assert.equal(cleanMdx(input), "Body.\n");
  });

  test("output ends with exactly one trailing newline", () => {
    const result = cleanMdx("Hello");
    assert.ok(result.endsWith("\n"));
    assert.ok(!result.endsWith("\n\n"));
  });
});

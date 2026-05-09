import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { extractMeta } from "../src/extract-meta.ts";

describe("extractMeta", () => {
  test("extracts title and description from frontmatter", () => {
    const input = `---
title: Hello world
description: A short post.
---

Body.`;
    assert.deepEqual(extractMeta(input), {
      title: "Hello world",
      description: "A short post.",
    });
  });

  test("unquotes double-quoted frontmatter values", () => {
    const input = `---
title: "Hello, world"
description: "It's a post."
---`;
    assert.deepEqual(extractMeta(input), {
      title: "Hello, world",
      description: "It's a post.",
    });
  });

  test("unquotes single-quoted frontmatter values", () => {
    const input = `---
title: 'Hello'
---`;
    const meta = extractMeta(input);
    assert.equal(meta.title, "Hello");
  });

  test("falls back to first H1 when frontmatter has no title", () => {
    const input = `# First Heading

Body content.`;
    assert.equal(extractMeta(input).title, "First Heading");
  });

  test("frontmatter title wins over body H1", () => {
    const input = `---
title: From frontmatter
---

# From body

Body.`;
    assert.equal(extractMeta(input).title, "From frontmatter");
  });

  test("returns empty object when neither frontmatter nor H1 present", () => {
    const input = `## Just a sub-heading

No H1 here.`;
    assert.deepEqual(extractMeta(input), {});
  });

  test("ignores frontmatter title field if missing", () => {
    const input = `---
description: Only description
---

# Body H1`;
    assert.deepEqual(extractMeta(input), {
      title: "Body H1",
      description: "Only description",
    });
  });
});

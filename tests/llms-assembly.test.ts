import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  assembleLlmsFullTxt,
  assembleLlmsTxt,
  type CapturedRoute,
} from "../src/llms-assembly.ts";

const NO_OPTIONS = { siteName: undefined, siteDescription: undefined };

const SITE = { siteName: "My Site", siteDescription: "A test site." };

function route(over: Partial<CapturedRoute>): CapturedRoute {
  return {
    title: "Title",
    description: undefined,
    body: "Body.",
    mdUrl: "/page.md",
    htmlUrl: "/page",
    ...over,
  };
}

describe("assembleLlmsTxt", () => {
  test("renders site header with name and description", () => {
    const output = assembleLlmsTxt([], SITE);
    assert.match(output, /^# My Site\n/);
    assert.match(output, /\n> A test site\.\n/);
  });

  test("falls back to 'Site' when siteName is undefined", () => {
    const output = assembleLlmsTxt([], NO_OPTIONS);
    assert.match(output, /^# Site\n/);
  });

  test("omits the blockquote when siteDescription is undefined", () => {
    const output = assembleLlmsTxt([], { siteName: "X" });
    assert.doesNotMatch(output, />/);
  });

  test("emits all routes as a single flat bullet list", () => {
    const captures = [
      route({ title: "Home", description: "Welcome.", mdUrl: "/index.md" }),
      route({ title: "About", description: "About us.", mdUrl: "/about.md" }),
      route({ title: "First", mdUrl: "/items/first.md" }),
    ];
    const output = assembleLlmsTxt(captures, SITE);
    assert.match(output, /- \[Home\]\(\/index\.md\) — Welcome\./);
    assert.match(output, /- \[About\]\(\/about\.md\) — About us\./);
    assert.match(output, /- \[First\]\(\/items\/first\.md\)/);
  });

  test("does not introduce any '##' subheadings of its own", () => {
    const captures = [
      route({ mdUrl: "/index.md" }),
      route({ mdUrl: "/items/a.md" }),
    ];
    const output = assembleLlmsTxt(captures, SITE);
    assert.doesNotMatch(output, /^## /m);
  });

  test("omits description portion when missing", () => {
    const output = assembleLlmsTxt(
      [route({ title: "Home", description: undefined })],
      SITE,
    );
    assert.match(output, /- \[Home\]\(\/page\.md\)\n/);
    assert.doesNotMatch(output, / — /);
  });

  test("emits no list block when there are no captures", () => {
    const output = assembleLlmsTxt([], SITE);
    assert.doesNotMatch(output, /^- /m);
  });

  test("output ends with exactly one trailing newline", () => {
    const output = assembleLlmsTxt([route({})], SITE);
    assert.ok(output.endsWith("\n"));
    assert.ok(!output.endsWith("\n\n"));
  });
});

describe("assembleLlmsFullTxt", () => {
  test("inlines bodies as ### sections in URL-sorted order", () => {
    const captures = [
      route({ title: "About", mdUrl: "/about.md", body: "About body." }),
      route({ title: "Item", mdUrl: "/items/x.md", body: "Item body." }),
    ];
    const output = assembleLlmsFullTxt(captures, SITE);
    assert.match(output, /### About\n\nAbout body\.\n/);
    assert.match(output, /### Item\n\nItem body\.\n/);
    // Captures are passed in already-sorted order; assembly must preserve it.
    assert.ok(output.indexOf("### About") < output.indexOf("### Item"));
  });

  test("does not introduce any '##' subheadings of its own", () => {
    const captures = [route({ mdUrl: "/index.md", body: "x" })];
    const output = assembleLlmsFullTxt(captures, SITE);
    assert.doesNotMatch(output, /^## /m);
  });

  test("output ends with exactly one trailing newline", () => {
    const output = assembleLlmsFullTxt([route({ body: "x" })], SITE);
    assert.ok(output.endsWith("\n"));
    assert.ok(!output.endsWith("\n\n"));
  });
});

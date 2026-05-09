import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { IntegrationResolvedRoute } from "astro";
import {
  buildManifest,
  findMdEntryFor,
  findMdSiblingFor,
  mdPatternToHtmlPattern,
} from "../src/manifest.ts";

// Build a minimal IntegrationResolvedRoute for testing — Astro's full type has
// more fields, but the manifest builder only reads `origin`, `pattern`,
// `params`, and `entrypoint`. Cast through unknown to bypass strict checks.
function mockRoute(overrides: Partial<{
  origin: string;
  pattern: string;
  params: string[];
  entrypoint: string;
}>): IntegrationResolvedRoute {
  return {
    origin: "project",
    pattern: "/",
    params: [],
    entrypoint: "/path/to/file.ts",
    ...overrides,
  } as unknown as IntegrationResolvedRoute;
}

describe("mdPatternToHtmlPattern", () => {
  test("/index.md → /", () => {
    assert.equal(mdPatternToHtmlPattern("/index.md"), "/");
  });

  test("/foo.md → /foo", () => {
    assert.equal(mdPatternToHtmlPattern("/foo.md"), "/foo");
  });

  test("/foo/index.md → /foo", () => {
    assert.equal(mdPatternToHtmlPattern("/foo/index.md"), "/foo");
  });

  test("/posts/[slug].md → /posts/[slug]", () => {
    assert.equal(
      mdPatternToHtmlPattern("/posts/[slug].md"),
      "/posts/[slug]",
    );
  });

  test("returns input unchanged when not ending in .md", () => {
    assert.equal(mdPatternToHtmlPattern("/something"), "/something");
  });
});

describe("buildManifest", () => {
  test("filters non-md routes out", () => {
    const routes = [
      mockRoute({ pattern: "/posts/[slug]" }),
      mockRoute({ pattern: "/posts/[slug].md", params: ["slug"] }),
      mockRoute({ pattern: "/atom.xml" }),
    ];
    const manifest = buildManifest(routes);
    assert.equal(manifest.mdRoutes.length, 1);
    assert.equal(manifest.mdRoutes[0]!.mdPattern, "/posts/[slug].md");
  });

  test("filters routes whose origin is not 'project'", () => {
    const routes = [
      mockRoute({ pattern: "/foo.md", origin: "internal" }),
      mockRoute({ pattern: "/bar.md", origin: "project" }),
    ];
    const manifest = buildManifest(routes);
    assert.equal(manifest.mdRoutes.length, 1);
    assert.equal(manifest.mdRoutes[0]!.mdPattern, "/bar.md");
  });

  test("classifies per-entry routes by params length", () => {
    const routes = [
      mockRoute({ pattern: "/posts.md" }),
      mockRoute({ pattern: "/posts/[slug].md", params: ["slug"] }),
    ];
    const manifest = buildManifest(routes);
    const [staticRoute, perEntry] = manifest.mdRoutes;
    assert.equal(staticRoute!.isPerEntry, false);
    assert.equal(perEntry!.isPerEntry, true);
  });

  test("derives htmlPattern for each route", () => {
    const routes = [
      mockRoute({ pattern: "/index.md" }),
      mockRoute({ pattern: "/posts.md" }),
      mockRoute({ pattern: "/posts/[slug].md", params: ["slug"] }),
    ];
    const manifest = buildManifest(routes);
    assert.equal(manifest.mdRoutes[0]!.htmlPattern, "/");
    assert.equal(manifest.mdRoutes[1]!.htmlPattern, "/posts");
    assert.equal(manifest.mdRoutes[2]!.htmlPattern, "/posts/[slug]");
  });
});

describe("findMdSiblingFor", () => {
  const manifest = buildManifest([
    mockRoute({ pattern: "/index.md" }),
    mockRoute({ pattern: "/posts.md" }),
    mockRoute({ pattern: "/posts/[slug].md", params: ["slug"] }),
  ]);

  test("/ → /index.md", () => {
    assert.equal(findMdSiblingFor("/", manifest), "/index.md");
  });

  test("/posts → /posts.md", () => {
    assert.equal(findMdSiblingFor("/posts", manifest), "/posts.md");
  });

  test("/posts/hello-world → /posts/hello-world.md (dynamic match)", () => {
    assert.equal(
      findMdSiblingFor("/posts/hello-world", manifest),
      "/posts/hello-world.md",
    );
  });

  test("returns undefined for unknown paths", () => {
    assert.equal(findMdSiblingFor("/about", manifest), undefined);
  });

  test("returns undefined for an .md path itself", () => {
    assert.equal(findMdSiblingFor("/posts.md", manifest), undefined);
  });

  test("returns undefined for any .md path even when a catch-all pattern would match", () => {
    const catchAllManifest = buildManifest([
      mockRoute({ pattern: "/[...rest].md", params: ["...rest"] }),
    ]);
    assert.equal(findMdSiblingFor("/anything.md", catchAllManifest), undefined);
    assert.equal(findMdSiblingFor("/foo/bar.md", catchAllManifest), undefined);
  });
});

describe("findMdEntryFor", () => {
  const manifest = buildManifest([
    mockRoute({ pattern: "/index.md" }),
    mockRoute({ pattern: "/posts.md" }),
    mockRoute({ pattern: "/posts/[slug].md", params: ["slug"] }),
  ]);

  test("returns the static entry for an exact .md URL", () => {
    const entry = findMdEntryFor("/posts.md", manifest);
    assert.equal(entry?.mdPattern, "/posts.md");
    assert.equal(entry?.isPerEntry, false);
  });

  test("returns the per-entry entry for a concrete .md URL", () => {
    const entry = findMdEntryFor("/posts/hello-world.md", manifest);
    assert.equal(entry?.mdPattern, "/posts/[slug].md");
    assert.equal(entry?.isPerEntry, true);
  });

  test("returns undefined for an unrelated URL", () => {
    assert.equal(findMdEntryFor("/about.md", manifest), undefined);
  });
});

// astro-slop integration entry. Wires up the four cross-cutting pieces:
// - Middleware that injects <link rel="alternate"> in HTML responses (dev/SSR)
// - astro:routes:resolved hook that builds the route manifest
// - astro:config:setup hook that injects /llms.txt and /llms-full.txt routes
//   (only if the user hasn't shipped their own override)
// - astro:build:done hook that injects alt-links into static HTML output

import type { AstroIntegration } from "astro";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { injectAlternateLinks } from "./inject-alternate-links.js";
import { buildManifest } from "./manifest.js";
import {
  getOrCreateSharedState,
  type ResolvedSlopOptions,
  type SlopState,
} from "./state.js";

export interface SlopOptions {
  /** Site name for the llms.txt H1. Defaults to `"Site"` when unset. */
  siteName?: string;
  /** Site description for the llms.txt blockquote. Omitted from output if unset. */
  siteDescription?: string;
  /** Inject `<link rel="alternate" type="text/markdown">` into HTML head. Default `true`. */
  injectAlternateLink?: boolean;
  /** Generate `/llms-full.txt` alongside `/llms.txt`. Default `true`. */
  llmsFullTxt?: boolean;
  /**
   * HTTP content negotiation: if a request's `Accept` header prefers
   * `text/markdown` over `text/html`, redirect to the `.md` sibling.
   * Only fires at request time (dev / SSR): static prerender bakes one
   * file per URL, so dynamic negotiation isn't possible there. Default `true`.
   */
  contentNegotiation?: boolean;
}

const DEFAULTS: Required<
  Pick<
    SlopOptions,
    "injectAlternateLink" | "llmsFullTxt" | "contentNegotiation"
  >
> = {
  injectAlternateLink: true,
  llmsFullTxt: true,
  contentNegotiation: true,
};

const ROUTE_FILE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".astro"] as const;

/** True if the user has a route file at `src/pages/<basename>` with any common extension. */
function userRouteExists(srcDir: URL, basename: string): boolean {
  const pagesPath = fileURLToPath(new URL("pages/", srcDir));
  return ROUTE_FILE_EXTENSIONS.some((ext) =>
    existsSync(pagesPath + basename + ext),
  );
}

export default function slop(options: SlopOptions = {}): AstroIntegration {
  const resolved: ResolvedSlopOptions = { ...DEFAULTS, ...options };

  // slop() may be invoked in multiple realms (config-loading vs SSR runtime).
  // getOrCreateSharedState reuses the existing process-wide state so all hook
  // closures and route handlers reference the same mutable record.
  const state: SlopState = getOrCreateSharedState(resolved);

  return {
    name: "astro-slop",
    hooks: {
      "astro:config:setup": ({
        injectRoute,
        addMiddleware,
        config: astroConfig,
      }) => {
        addMiddleware({
          entrypoint: new URL("./middleware.js", import.meta.url),
          order: "post",
        });

        // Skip injection when the user has shipped their own override at
        // src/pages/<route>. Their file then takes precedence; ours is dormant.
        if (!userRouteExists(astroConfig.srcDir, "llms.txt")) {
          injectRoute({
            pattern: "/llms.txt",
            entrypoint: new URL("./llms-txt.js", import.meta.url),
          });
        }

        if (
          resolved.llmsFullTxt &&
          !userRouteExists(astroConfig.srcDir, "llms-full.txt")
        ) {
          injectRoute({
            pattern: "/llms-full.txt",
            entrypoint: new URL("./llms-full-txt.js", import.meta.url),
          });
        }
      },
      "astro:routes:resolved": ({ routes }) => {
        state.manifest = buildManifest(routes);
      },
      "astro:build:done": async ({ dir }) => {
        if (!resolved.injectAlternateLink || !state.manifest) return;
        await injectAlternateLinks(dir, state.manifest);
      },
    },
  };
}

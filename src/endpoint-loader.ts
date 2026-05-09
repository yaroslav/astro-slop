// Helpers for dynamically loading user endpoint modules and expanding their
// dynamic routes to concrete URL pairs.
//
// Used by /llms.txt and /llms-full.txt generators to enumerate the actual
// URLs of per-entry routes (which are stored as patterns in the manifest).

import { pathToFileURL } from "node:url";
import type { MdRouteEntry } from "./manifest.js";
import { mdPatternToHtmlPattern } from "./manifest.js";
import { substituteParams } from "./paths.js";

export interface EndpointModule {
  getStaticPaths?: () => Promise<Array<{ params: unknown; props: unknown }>>;
  GET: (context: { params: unknown; props: unknown }) => Response | Promise<Response>;
}

export interface ExpandedRoute {
  /** Concrete .md URL with params substituted, e.g. `/posts/hello-world.md`. */
  mdUrl: string;
  /** Concrete HTML URL, e.g. `/posts/hello-world`. */
  htmlUrl: string;
  /** Params that produced this URL — passed through to GET. */
  params: Record<string, string>;
  /** Props returned by getStaticPaths for this path. */
  props: unknown;
  /** Pre-loaded module for follow-up GET invocations. */
  module: EndpointModule;
}

export async function loadEndpoint(entrypoint: string): Promise<EndpointModule> {
  const moduleUrl = entrypoint.startsWith("file:")
    ? entrypoint
    : pathToFileURL(entrypoint).toString();
  return (await import(/* @vite-ignore */ moduleUrl)) as EndpointModule;
}

/**
 * Expand a single .md route entry to one ExpandedRoute per concrete path.
 * - Static routes (no params): one entry with the pattern as URL.
 * - Per-entry routes: invokes getStaticPaths and yields one entry per result.
 */
export async function expandRoute(entry: MdRouteEntry): Promise<ExpandedRoute[]> {
  const module = await loadEndpoint(entry.entrypoint);

  if (!entry.isPerEntry || !module.getStaticPaths) {
    return [
      {
        mdUrl: entry.mdPattern,
        htmlUrl: entry.htmlPattern,
        params: {},
        props: undefined,
        module,
      },
    ];
  }

  const paths = await module.getStaticPaths();
  return paths.map((p) => {
    const params = p.params as Record<string, string>;
    const mdUrl = substituteParams(entry.mdPattern, params);
    return {
      mdUrl,
      htmlUrl: mdPatternToHtmlPattern(mdUrl),
      params,
      props: p.props,
      module,
    };
  });
}

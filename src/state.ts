// Process-shared mutable state for the integration.
//
// Astro can evaluate astro.config.mjs in multiple realms (config-loading,
// SSR runtime, etc.) which each have their own ES module instances. To keep
// the integration's state consistent across these realms we anchor it on
// `globalThis` under a `Symbol.for(...)` key; the same symbol resolves in
// every realm of a given process, giving us a process-wide singleton without
// disk I/O or virtual modules.

import type { Manifest } from "./manifest.js";
import type { SlopOptions } from "./integration.js";

/** Shape of the integration's resolved options + runtime manifest. */
export interface SlopState {
  options: ResolvedSlopOptions;
  manifest: Manifest | undefined;
}

/** Options after defaults have been applied. */
export type ResolvedSlopOptions = Required<
  Pick<
    SlopOptions,
    "injectAlternateLink" | "llmsFullTxt" | "contentNegotiation"
  >
> &
  SlopOptions;

const STATE_KEY = Symbol.for("astro-slop:state");

type GlobalWithSlop = typeof globalThis & {
  [STATE_KEY]?: SlopState;
};

/**
 * Lazily-initialize the shared state. Subsequent calls return the existing
 * record so all hooks and runtime code mutate and read the same object,
 * even across module realms.
 */
export function getOrCreateSharedState(
  options: ResolvedSlopOptions,
): SlopState {
  const g = globalThis as GlobalWithSlop;
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = { options, manifest: undefined };
  }
  return g[STATE_KEY]!;
}

/**
 * Read the shared state. Throws if the integration hasn't been registered yet
 * — that's a signal that consumer code is being called from a context where
 * `slop()` never ran (typically a misconfigured astro.config.mjs).
 */
export function getSlopState(): SlopState {
  const state = (globalThis as GlobalWithSlop)[STATE_KEY];
  if (!state) {
    throw new Error(
      "astro-slop: state accessed before integration registered. " +
        "Make sure slop() is in your integrations array in astro.config.mjs.",
    );
  }
  return state;
}

// Sentinel strings used to splice the auto-generated /llms.txt and
// /llms-full.txt bodies into user-overridden endpoints during static build.
//
// Flow:
//   1. User's `src/pages/llms.txt.ts` calls `defaultLlmsTxt(context)`.
//   2. In a prerender context, that returns the sentinel.
//   3. Astro writes the user's response to `dist/llms.txt` (with the sentinel
//      embedded inside whatever wrapping content they composed).
//   4. `astro:build:done` reads `dist/llms.txt`, walks `dist/*.md` to compute
//      the auto-gen body, and `replaceAll`s the sentinel.
//
// The marker is intentionally unique — triple underscores plus an upper-case
// namespace string — to make accidental collisions vanishingly unlikely.

export const LLMS_TXT_SENTINEL = "___ASTRO_SLOP_LLMS_TXT_AUTOGEN___";
export const LLMS_FULL_TXT_SENTINEL =
  "___ASTRO_SLOP_LLMS_FULL_TXT_AUTOGEN___";

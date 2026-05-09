import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Tests use `assert.ok(result)` after a null-or-string return — the
      // narrowing helper isn't always idiomatic. Allow non-null assertions
      // sparingly across the codebase rather than forbidding them.
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);

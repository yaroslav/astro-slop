import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  LLMS_FULL_TXT_SENTINEL,
  LLMS_TXT_SENTINEL,
} from "../src/sentinels.ts";

describe("sentinels", () => {
  test("are non-empty distinct strings", () => {
    assert.ok(LLMS_TXT_SENTINEL.length > 0);
    assert.ok(LLMS_FULL_TXT_SENTINEL.length > 0);
    assert.notEqual(LLMS_TXT_SENTINEL, LLMS_FULL_TXT_SENTINEL);
  });

  test("are the kind of marker that won't collide with normal markdown", () => {
    // Triple-underscore + ALL_CAPS namespace is exceedingly unlikely to
    // appear naturally in someone's markdown. If this ever changes, document
    // why in CHANGELOG since users may have written guards against it.
    assert.match(LLMS_TXT_SENTINEL, /^___[A-Z_]+___$/);
    assert.match(LLMS_FULL_TXT_SENTINEL, /^___[A-Z_]+___$/);
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import { getAiNumber } from "./aiResponse.ts";

test("getAiNumber normalizes numeric-like values", () => {
  assert.equal(getAiNumber(3), 3);
  assert.equal(getAiNumber("4"), 4);
  assert.equal(getAiNumber("oops", 7), 7);
});

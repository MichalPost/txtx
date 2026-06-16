import assert from "node:assert/strict";
import test from "node:test";

import { getAiStringArray } from "./aiResponse.ts";

test("getAiStringArray filters non-string entries", () => {
  assert.deepEqual(getAiStringArray(["a", 1, "b", null]), ["a", "b"]);
  assert.deepEqual(getAiStringArray(undefined), []);
});

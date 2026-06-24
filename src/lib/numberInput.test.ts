import assert from "node:assert/strict";
import test from "node:test";

import { parseBoundedFloatInput, parseBoundedIntegerInput } from "./numberInput.ts";

test("parseBoundedIntegerInput preserves zero and falls back for blank input", () => {
  assert.equal(parseBoundedIntegerInput("0", 7, { min: 0 }), 0);
  assert.equal(parseBoundedIntegerInput("", 7, { min: 0 }), 7);
});

test("parseBoundedIntegerInput clamps to min and max", () => {
  assert.equal(parseBoundedIntegerInput("-5", 7, { min: 0, max: 10 }), 0);
  assert.equal(parseBoundedIntegerInput("99", 7, { min: 0, max: 10 }), 10);
});

test("parseBoundedFloatInput preserves zero and clamps range", () => {
  assert.equal(parseBoundedFloatInput("0", 0.2, { min: 0, max: 2 }), 0);
  assert.equal(parseBoundedFloatInput("2.5", 0.2, { min: 0, max: 2 }), 2);
  assert.equal(parseBoundedFloatInput("", 0.2, { min: 0, max: 2 }), 0.2);
});

import assert from "node:assert/strict";
import test from "node:test";

import { formatTaskRetryError } from "./taskRetryError.ts";

test("formatTaskRetryError formats Error instances", () => {
  assert.equal(formatTaskRetryError(new Error("retry unavailable")), "重新发起任务失败：retry unavailable");
});

test("formatTaskRetryError formats non-Error values", () => {
  assert.equal(formatTaskRetryError("oops"), "重新发起任务失败：oops");
});

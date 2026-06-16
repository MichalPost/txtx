import assert from "node:assert/strict";
import test from "node:test";

import { formatTaskActionError } from "./taskActionError.ts";

test("formatTaskActionError formats Error instances", () => {
  assert.equal(formatTaskActionError("取消任务", new Error("network down")), "取消任务失败：network down");
});

test("formatTaskActionError formats non-Error values", () => {
  assert.equal(formatTaskActionError("暂停任务", "unknown"), "暂停任务失败：unknown");
});

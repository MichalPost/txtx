import assert from "node:assert/strict";
import test from "node:test";

import { formatCreateScanTaskError, formatTaskInitError } from "./taskInitError.ts";

test("formatTaskInitError formats Error instances", () => {
  assert.equal(formatTaskInitError(new Error("backend unavailable")), "初始化任务列表失败：backend unavailable");
});

test("formatTaskInitError formats non-Error values", () => {
  assert.equal(formatTaskInitError("oops"), "初始化任务列表失败：oops");
});

test("formatCreateScanTaskError formats scan task failures", () => {
  assert.equal(
    formatCreateScanTaskError(new Error("backend unavailable")),
    "创建扫描任务失败：backend unavailable",
  );
});

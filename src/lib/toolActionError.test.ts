import assert from "node:assert/strict";
import test from "node:test";

import { formatToolActionError } from "./toolActionError.ts";

test("formatToolActionError formats Error instances", () => {
  assert.equal(formatToolActionError("选择文件", new Error("dialog unavailable")), "选择文件失败：dialog unavailable");
});

test("formatToolActionError formats non-Error values", () => {
  assert.equal(formatToolActionError("保存设置", "oops"), "保存设置失败：oops");
});

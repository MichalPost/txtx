import assert from "node:assert/strict";
import test from "node:test";

import { formatTaskCreateError, formatTaskCreateSuccess } from "./taskCreateFeedback.ts";

test("formatTaskCreateError formats scan task failures", () => {
  assert.equal(
    formatTaskCreateError("scan", new Error("backend unavailable")),
    "创建扫描任务失败：backend unavailable",
  );
});

test("formatTaskCreateSuccess formats common success messages", () => {
  assert.equal(formatTaskCreateSuccess("single"), "已创建单本下载任务，请在任务管理查看进度");
  assert.equal(formatTaskCreateSuccess("multi_single", 3), "已创建 3 个下载任务，请前往「任务管理」查看");
});

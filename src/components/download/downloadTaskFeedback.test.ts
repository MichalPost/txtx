import assert from "node:assert/strict";
import test from "node:test";

import { formatBatchImportResult } from "./downloadTaskFeedback.ts";

test("formatBatchImportResult summarizes partial batch creation failures", () => {
  assert.equal(
    formatBatchImportResult({
      requestedCount: 5,
      successCount: 3,
      failureCount: 2,
      duplicateCount: 1,
      invalidCount: 1,
    }),
    "已创建 3 个任务，2 个失败；另有 1 条重复链接、1 条无效内容已跳过",
  );
});

test("formatBatchImportResult describes all-skipped imports", () => {
  assert.equal(
    formatBatchImportResult({
      requestedCount: 0,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 2,
      invalidCount: 3,
    }),
    "没有可创建的任务：已跳过 2 条重复链接和 3 条无效内容",
  );
});

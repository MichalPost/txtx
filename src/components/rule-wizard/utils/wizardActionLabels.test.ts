import assert from "node:assert/strict";
import test from "node:test";

import { formatWizardActionError } from "./wizardActionError.ts";

test("formatWizardActionError supports paginated selection errors", () => {
  assert.equal(
    formatWizardActionError("获取第 2 页书籍列表", new Error("timeout")),
    "获取第 2 页书籍列表失败：timeout",
  );
});

test("formatWizardActionError supports chapter preview actions", () => {
  assert.equal(
    formatWizardActionError("抓取章节预览", "not found"),
    "抓取章节预览失败：not found",
  );
});

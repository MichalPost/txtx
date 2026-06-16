import assert from "node:assert/strict";
import test from "node:test";

import { formatWizardActionError } from "./wizardActionError.ts";

test("formatWizardActionError formats Error instances", () => {
  assert.equal(formatWizardActionError("AI 分析目录页", new Error("model timeout")), "AI 分析目录页失败：model timeout");
});

test("formatWizardActionError formats non-Error values", () => {
  assert.equal(formatWizardActionError("获取章节页面", "bad gateway"), "获取章节页面失败：bad gateway");
});

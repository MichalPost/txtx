import assert from "node:assert/strict";
import test from "node:test";

import { formatToolActionError } from "../../lib/toolActionError.ts";

test("merge failures are formatted as action errors", () => {
  assert.equal(
    formatToolActionError("合并文件", new Error("permission denied")),
    "合并文件失败：permission denied",
  );
});

test("split failures are formatted as action errors", () => {
  assert.equal(formatToolActionError("分割文件", "bad pattern"), "分割文件失败：bad pattern");
});

test("convert failures are formatted as action errors", () => {
  assert.equal(
    formatToolActionError("转换文件", new Error("decode failed")),
    "转换文件失败：decode failed",
  );
});

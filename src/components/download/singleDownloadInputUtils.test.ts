import assert from "node:assert/strict";
import test from "node:test";

import {
  describeSingleDownloadFailure,
  validateSingleDownloadUrl,
} from "./singleDownloadInputUtils.ts";

test("validateSingleDownloadUrl reports missing and malformed input", () => {
  assert.equal(validateSingleDownloadUrl(""), "先输入小说详情页 URL，再开始下载");
  assert.equal(validateSingleDownloadUrl("example.com/book"), "请输入以 http:// 或 https:// 开头的小说链接");
  assert.equal(validateSingleDownloadUrl("https://ok.example/book"), null);
});

test("describeSingleDownloadFailure keeps context and gives recovery hints", () => {
  assert.equal(
    describeSingleDownloadFailure(new Error("unsupported site")),
    "创建失败，请保留当前链接检查站点规则后重试",
  );
  assert.equal(
    describeSingleDownloadFailure("network timeout"),
    "创建失败，当前链接已保留，可稍后重试或改走扫描任务",
  );
});

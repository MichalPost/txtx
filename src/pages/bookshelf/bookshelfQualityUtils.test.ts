import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChapterQualityExportText,
  buildChapterQualitySummary,
  splitBookIntoChapters,
} from "./bookshelfQualityUtils.ts";

test("splitBookIntoChapters keeps chapter blocks in order", () => {
  const content = ["序章", "第一章 初见", "这里是正文", "第二章 再会", "继续正文"].join("\n");

  const chapters = splitBookIntoChapters(content);

  assert.equal(chapters.length, 3);
  assert.match(chapters[1] ?? "", /第一章 初见/);
  assert.match(chapters[2] ?? "", /第二章 再会/);
});

test("buildChapterQualitySummary marks short chapters as suspicious", () => {
  const content = [
    "第一章 开始",
    "短内容",
    "第二章 展开",
    "这是一段明显更长的章节内容".repeat(50),
  ].join("\n");

  const summary = buildChapterQualitySummary(content, 100);

  assert.equal(summary.chapters.length, 2);
  assert.equal(summary.suspiciousCount, 1);
  assert.equal(summary.stats[0]?.suspicious, true);
  assert.equal(summary.stats[1]?.suspicious, false);
});

test("buildChapterQualityExportText includes suspicious chapter details", () => {
  const summary = buildChapterQualitySummary(
    ["第一章", "很短", "第二章", "这是长章节内容".repeat(40)].join("\n"),
    120,
  );

  const report = buildChapterQualityExportText("示例书", summary);

  assert.match(report, /书籍：示例书/);
  assert.match(report, /可疑章节：1/);
  assert.match(report, /第 1 章：/);
});

import assert from "node:assert/strict";
import test from "node:test";

import type { HistoryEntry } from "@/types";

import { buildHistoryCsv, buildHistoryExportFilename } from "./historyExportUtils.ts";

const entry: HistoryEntry = {
  name: "书名, 含逗号",
  url: "https://example.com/book",
  site: "example.com",
  downloaded_at: "2026-06-24 10:30",
  status: "error",
  message: '失败原因 "网络"\n请重试',
};

test("buildHistoryCsv exports headers and escaped rows", () => {
  assert.equal(
    buildHistoryCsv([entry]),
    [
      "状态,书名,来源站点,链接,下载时间,备注",
      '失败,"书名, 含逗号",example.com,https://example.com/book,2026-06-24 10:30,"失败原因 ""网络""\n请重试"',
    ].join("\n"),
  );
});

test("buildHistoryExportFilename uses local export date prefix", () => {
  assert.equal(
    buildHistoryExportFilename(new Date("2026-06-24T12:00:00.000Z")),
    "txtx-history-2026-06-24.csv",
  );
});

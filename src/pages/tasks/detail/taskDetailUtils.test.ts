import assert from "node:assert/strict";
import test from "node:test";

import type { LogEntry, TaskRecord } from "@/types";

import { buildFailedLogReport, getRecentFailureMessages } from "./taskDetailUtils.ts";

test("getRecentFailureMessages returns newest unique error messages", () => {
  const logs: LogEntry[] = [
    { id: 1, timestamp: "10:00:00", level: "info", message: "开始扫描" },
    { id: 2, timestamp: "10:00:01", level: "error", message: "站点 A 失败" },
    { id: 3, timestamp: "10:00:02", level: "error", message: "站点 B 失败" },
    { id: 4, timestamp: "10:00:03", level: "error", message: "站点 A 失败" },
  ];

  assert.deepEqual(getRecentFailureMessages(logs), ["站点 A 失败", "站点 B 失败"]);
});

test("buildFailedLogReport includes task metadata and numbered failures", () => {
  const task: TaskRecord = {
    id: "task-1",
    kind: "single_download",
    status: "failed",
    label: "单本: demo",
    source_url: "https://example.com/book",
    retry_context: null,
    created_at: "2026-06-21 10:00:00",
    finished_at: "2026-06-21 10:05:00",
    total: 1,
    completed: 1,
    success_count: 0,
    error_count: 1,
    scan_items: [],
    scan_stats: null,
    stats: null,
    error_message: "连接超时",
  };

  const report = buildFailedLogReport(task, ["站点 A 失败", "重试后仍失败"]);

  assert.match(report, /任务：单本: demo/);
  assert.match(report, /来源链接：https:\/\/example\.com\/book/);
  assert.match(report, /任务错误：连接超时/);
  assert.match(report, /1\. 站点 A 失败/);
  assert.match(report, /2\. 重试后仍失败/);
});

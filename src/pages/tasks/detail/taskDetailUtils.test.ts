import assert from "node:assert/strict";
import test from "node:test";

import type { LogEntry, TaskRecord } from "@/types";

import { buildFailedLogReport, getRecentFailureMessages, getTaskRetryAction } from "./taskDetailUtils.ts";

function makeTask(overrides: Partial<TaskRecord>): TaskRecord {
  return {
    id: overrides.id ?? "task-1",
    kind: overrides.kind ?? "single_download",
    status: overrides.status ?? "failed",
    label: overrides.label ?? "任务",
    source_url: overrides.source_url ?? null,
    retry_context: overrides.retry_context ?? null,
    preview_draft: overrides.preview_draft ?? null,
    created_at: overrides.created_at ?? "2026-06-21 10:00:00",
    finished_at: overrides.finished_at ?? null,
    total: overrides.total ?? 0,
    completed: overrides.completed ?? 0,
    success_count: overrides.success_count ?? 0,
    error_count: overrides.error_count ?? 0,
    scan_items: overrides.scan_items ?? [],
    scan_stats: overrides.scan_stats ?? null,
    stats: overrides.stats ?? null,
    error_message: overrides.error_message ?? null,
  };
}

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
  const task = makeTask({
    label: "单本: demo",
    source_url: "https://example.com/book",
    finished_at: "2026-06-21 10:05:00",
    total: 1,
    completed: 1,
    success_count: 0,
    error_count: 1,
    scan_items: [],
    scan_stats: null,
    stats: null,
    error_message: "连接超时",
  });

  const report = buildFailedLogReport(task, ["站点 A 失败", "重试后仍失败"]);

  assert.match(report, /任务：单本: demo/);
  assert.match(report, /来源链接：https:\/\/example\.com\/book/);
  assert.match(report, /任务错误：连接超时/);
  assert.match(report, /1\. 站点 A 失败/);
  assert.match(report, /2\. 重试后仍失败/);
});

test("getTaskRetryAction labels paused tasks as continue actions", () => {
  const action = getTaskRetryAction(
    makeTask({
      status: "paused",
      kind: "selected_download",
      retry_context: {
        scan_options: null,
        selected_items: [{ name: "书", url: "https://example.com/book", crawler_domain: "site", date: "2026-06-21" }],
      },
    }),
  );

  assert.deepEqual(action, {
    canRun: true,
    idleLabel: "继续任务",
    pendingLabel: "继续中...",
    unavailableReason: "",
  });
});

test("getTaskRetryAction disables selected retry when source context is missing", () => {
  const action = getTaskRetryAction(
    makeTask({
      status: "failed",
      kind: "selected_download",
      retry_context: { scan_options: null, selected_items: [] },
    }),
  );

  assert.equal(action.canRun, false);
  assert.equal(action.unavailableReason, "当前任务缺少可继续的下载列表，请重新创建任务。");
});

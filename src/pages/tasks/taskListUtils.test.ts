import test from "node:test";
import assert from "node:assert/strict";

import type { TaskRecord } from "@/types";

import {
  buildBulkTaskActionState,
  buildTaskListSummary,
  buildVisibleTaskWindow,
  deriveTaskListViewState,
  filterAndSortTasks,
} from "./taskListUtils.ts";

function makeTask(overrides: Partial<TaskRecord>): TaskRecord {
  return {
    id: overrides.id ?? "task-1",
    kind: overrides.kind ?? "single_download",
    status: overrides.status ?? "queued",
    label: overrides.label ?? "任务",
    source_url: overrides.source_url ?? null,
    retry_context: overrides.retry_context ?? null,
    created_at: overrides.created_at ?? "2026-06-20 10:00:00",
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

test("filterAndSortTasks filters by keyword and status", () => {
  const tasks = [
    makeTask({ id: "1", label: "三体", status: "done" }),
    makeTask({ id: "2", label: "凡人修仙传", status: "downloading" }),
    makeTask({ id: "3", label: "诡秘之主", status: "failed" }),
  ];

  const result = filterAndSortTasks(tasks, {
    search: "修仙",
    status: "active",
    sort: "created_desc",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "2");
});

test("filterAndSortTasks supports finished-first sorting", () => {
  const tasks = [
    makeTask({ id: "1", label: "旧任务", finished_at: "2026-06-20 09:00:00", status: "done" }),
    makeTask({ id: "2", label: "新任务", finished_at: "2026-06-20 12:00:00", status: "failed" }),
    makeTask({ id: "3", label: "运行中", status: "downloading", finished_at: null }),
  ];

  const result = filterAndSortTasks(tasks, {
    search: "",
    status: "all",
    sort: "recent_activity",
  });

  assert.deepEqual(
    result.map((task) => task.id),
    ["2", "1", "3"],
  );
});

test("filterAndSortTasks supports task kind filtering and created time sorting", () => {
  const tasks = [
    makeTask({ id: "1", kind: "single_download", created_at: "2026-06-20 12:00:00" }),
    makeTask({ id: "2", kind: "batch_download", created_at: "2026-06-20 10:00:00" }),
    makeTask({ id: "3", kind: "single_download", created_at: "2026-06-20 08:00:00" }),
  ];

  const result = filterAndSortTasks(tasks, {
    search: "",
    status: "all",
    sort: "created_asc",
    kind: "single_download",
  });

  assert.deepEqual(
    result.map((task) => task.id),
    ["3", "1"],
  );
});

test("buildTaskListSummary aggregates counts", () => {
  const tasks = [
    makeTask({ id: "1", status: "done" }),
    makeTask({ id: "2", status: "done" }),
    makeTask({ id: "3", status: "failed" }),
    makeTask({ id: "4", status: "downloading" }),
    makeTask({ id: "5", status: "preview" }),
  ];

  const summary = buildTaskListSummary(tasks);

  assert.deepEqual(summary, {
    total: 5,
    active: 2,
    queued: 1,
    finished: 3,
    failed: 1,
    successRate: 67,
  });
});

test("deriveTaskListViewState distinguishes empty, filtered, and refresh-needed states", () => {
  assert.deepEqual(
    deriveTaskListViewState({
      totalTasks: 0,
      visibleTasks: 0,
      search: "",
      status: "all",
      pollError: null,
    }),
    {
      title: "还没有任务",
      description: "新建一个扫描、批量或单本任务后，这里会持续显示进度和结果。",
      showClearFilters: false,
      showRefresh: false,
    },
  );

  assert.deepEqual(
    deriveTaskListViewState({
      totalTasks: 3,
      visibleTasks: 0,
      search: "修仙",
      status: "failed",
      pollError: null,
    }),
    {
      title: "没有符合条件的任务",
      description: "换个关键词、切换状态筛选，或一键清空筛选后再试。",
      showClearFilters: true,
      showRefresh: false,
    },
  );

  assert.deepEqual(
    deriveTaskListViewState({
      totalTasks: 3,
      visibleTasks: 0,
      search: "",
      status: "all",
      pollError: "network error",
    }),
    {
      title: "任务列表暂时不可用",
      description: "自动刷新失败了，可以手动刷新一次，或者先清空筛选条件再查看已有任务。",
      showClearFilters: false,
      showRefresh: true,
    },
  );
});

test("buildBulkTaskActionState only targets finished disposable tasks", () => {
  const tasks = [
    makeTask({ id: "done", status: "done" }),
    makeTask({ id: "failed", status: "failed", source_url: "https://example.com/failed" }),
    makeTask({ id: "cancelled", status: "cancelled" }),
    makeTask({ id: "paused", status: "paused", source_url: "https://example.com/paused" }),
    makeTask({ id: "downloading", status: "downloading" }),
    makeTask({ id: "preview", status: "preview" }),
  ];

  const result = buildBulkTaskActionState(tasks);

  assert.deepEqual(result.disposableTaskIds, ["done", "failed", "cancelled"]);
  assert.deepEqual(result.recoverableTaskIds, ["failed", "paused"]);
  assert.equal(result.canDeleteFinished, true);
  assert.equal(result.canRecoverFailed, true);
  assert.equal(result.deleteFinishedLabel, "清理 3 个已结束任务");
  assert.equal(result.recoverFailedLabel, "恢复 2 个失败/暂停任务");
});

test("buildBulkTaskActionState handles empty disposable list", () => {
  const result = buildBulkTaskActionState([
    makeTask({ id: "paused", status: "paused" }),
    makeTask({ id: "downloading", status: "downloading" }),
  ]);

  assert.deepEqual(result.disposableTaskIds, []);
  assert.deepEqual(result.recoverableTaskIds, []);
  assert.equal(result.canDeleteFinished, false);
  assert.equal(result.canRecoverFailed, false);
  assert.equal(result.deleteFinishedLabel, "没有可清理任务");
  assert.equal(result.recoverFailedLabel, "没有可恢复任务");
});

test("buildBulkTaskActionState only recovers tasks with replayable source context", () => {
  const result = buildBulkTaskActionState([
    makeTask({ id: "failed-single", status: "failed", kind: "single_download", source_url: "https://example.com/a" }),
    makeTask({ id: "missing-single", status: "failed", kind: "single_download", source_url: null, scan_items: [] }),
    makeTask({
      id: "selected",
      status: "paused",
      kind: "selected_download",
      retry_context: { selected_items: [{ title: "书", author: "作者", url: "https://example.com/b", site: "站点" }], scan_options: null },
    }),
    makeTask({ id: "missing-selected", status: "paused", kind: "selected_download", retry_context: null }),
    makeTask({ id: "scan", status: "failed", kind: "full_scan" }),
    makeTask({ id: "batch", status: "paused", kind: "batch_download" }),
    makeTask({ id: "done", status: "done", kind: "single_download", source_url: "https://example.com/done" }),
  ]);

  assert.deepEqual(result.recoverableTaskIds, ["failed-single", "selected", "scan", "batch"]);
  assert.equal(result.recoverFailedLabel, "恢复 4 个失败/暂停任务");
});

test("buildVisibleTaskWindow limits rendered tasks and computes the next batch", () => {
  const tasks = Array.from({ length: 12 }, (_, index) => makeTask({ id: String(index + 1) }));
  const firstWindow = buildVisibleTaskWindow(tasks, 5, 5);
  const nextWindow = buildVisibleTaskWindow(tasks, firstWindow.nextVisibleCount, 5);

  assert.deepEqual(firstWindow.tasks.map((task) => task.id), ["1", "2", "3", "4", "5"]);
  assert.equal(firstWindow.hasMore, true);
  assert.equal(firstWindow.nextVisibleCount, 10);
  assert.equal(nextWindow.tasks.length, 10);
  assert.equal(nextWindow.nextVisibleCount, 12);
});

test("buildVisibleTaskWindow clamps invalid counts", () => {
  const tasks = Array.from({ length: 3 }, (_, index) => makeTask({ id: String(index + 1) }));
  const result = buildVisibleTaskWindow(tasks, -10, 0);

  assert.equal(result.tasks.length, 1);
  assert.equal(result.visibleCount, 1);
  assert.equal(result.hasMore, true);
});

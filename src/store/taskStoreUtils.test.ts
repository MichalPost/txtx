import assert from "node:assert/strict";
import test from "node:test";

import type { TaskRecord } from "@/types";

import {
  buildDefaultPreviewDraft,
  hasManagedTask,
  hasRunningTask,
  mergeTaskSnapshots,
} from "./taskStoreUtils.ts";

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: overrides.id ?? "task-1",
    kind: overrides.kind ?? "single_download",
    status: overrides.status ?? "queued",
    label: overrides.label ?? "任务",
    source_url: overrides.source_url ?? null,
    retry_context: overrides.retry_context ?? null,
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

test("mergeTaskSnapshots removes tasks missing from the latest server response", () => {
  const existing = [makeTask({ id: "stale" }), makeTask({ id: "keep", status: "downloading" })];
  const fresh = [makeTask({ id: "keep", status: "done", finished_at: "2026-06-21 10:05:00" })];

  const result = mergeTaskSnapshots(existing, fresh, "stale");

  assert.deepEqual(result.tasks.map((task) => task.id), ["keep"]);
  assert.equal(result.activeTaskId, "keep");
  assert.equal(result.tasks[0]?.status, "done");
});

test("mergeTaskSnapshots keeps object identity when unchanged and appends new tasks", () => {
  const existingTask = makeTask({ id: "keep" });
  const result = mergeTaskSnapshots(
    [existingTask],
    [makeTask({ id: "keep" }), makeTask({ id: "new", status: "scanning" })],
    "keep",
  );

  assert.equal(result.tasks[0], existingTask);
  assert.deepEqual(result.tasks.map((task) => task.id), ["keep", "new"]);
  assert.equal(result.activeTaskId, "keep");
});

test("hasRunningTask and hasManagedTask reflect task lifecycle states", () => {
  const finished = [makeTask({ status: "done" }), makeTask({ id: "failed", status: "failed" })];
  const managed = [makeTask({ status: "preview" }), makeTask({ id: "paused", status: "paused" })];
  const running = [makeTask({ status: "scanning" })];

  assert.equal(hasRunningTask(finished), false);
  assert.equal(hasManagedTask(finished), false);
  assert.equal(hasManagedTask(managed), true);
  assert.equal(hasRunningTask(managed), false);
  assert.equal(hasRunningTask(running), true);
});

test("buildDefaultPreviewDraft uses stable defaults and preserves existing drafts", () => {
  const items = [
    { name: "A", url: "u1", site: "s1", date: "2026-06-22" },
    { name: "B", url: "u2", site: "s1", date: "2026-06-22", excluded_reason: "已存在" },
  ];

  assert.deepEqual(buildDefaultPreviewDraft(items), {
    deselected_urls: [],
    site_filter: "",
    scan_sort: "date",
    visible_count: 100,
  });

  const existing = {
    deselected_urls: ["u1"],
    site_filter: "s1",
    scan_sort: "name" as const,
    visible_count: 200,
  };

  assert.equal(buildDefaultPreviewDraft(items, existing), existing);
});

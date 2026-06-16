import assert from "node:assert/strict";
import test from "node:test";

import type { TaskRecord } from "@/types";

import { hasTaskChanged } from "./taskSync.ts";

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    kind: "batch_download",
    status: "downloading",
    label: "task",
    source_url: null,
    created_at: "2026-01-01 10:00:00",
    finished_at: null,
    total: 10,
    completed: 2,
    success_count: 1,
    error_count: 0,
    scan_items: [],
    scan_stats: null,
    stats: null,
    error_message: null,
    ...overrides,
  };
}

test("hasTaskChanged detects finished metadata changes", () => {
  const existing = makeTask();
  const server = makeTask({ finished_at: "2026-01-01 10:01:00", error_message: "boom" });

  assert.equal(hasTaskChanged(existing, server), true);
});

test("hasTaskChanged detects total and stats changes", () => {
  const existing = makeTask();
  const server = makeTask({
    total: 12,
    stats: { total: 12, completed: 3, success: 2, failed: 1 },
  });

  assert.equal(hasTaskChanged(existing, server), true);
});

test("hasTaskChanged ignores identical task snapshots", () => {
  const existing = makeTask({ stats: { total: 10, completed: 2, success: 1, failed: 0 } });
  const server = makeTask({ stats: { total: 10, completed: 2, success: 1, failed: 0 } });

  assert.equal(hasTaskChanged(existing, server), false);
});

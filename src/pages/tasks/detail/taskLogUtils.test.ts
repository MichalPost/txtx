import assert from "node:assert/strict";
import test from "node:test";

import type { LogEntry } from "@/types";

import { filterTaskLogs, summarizeTaskLogs } from "./taskLogUtils.ts";

const logs: LogEntry[] = [
  { id: 1, timestamp: "10:00:00", level: "info", message: "开始扫描" },
  { id: 2, timestamp: "10:00:01", level: "warn", message: "已跳过重复项" },
  { id: 3, timestamp: "10:00:02", level: "error", message: "下载失败：示例书" },
  { id: 4, timestamp: "10:00:03", level: "success", message: "下载成功：另一本书" },
];

test("filterTaskLogs applies level and keyword filters", () => {
  assert.deepEqual(
    filterTaskLogs(logs, "error", "示例"),
    [{ id: 3, timestamp: "10:00:02", level: "error", message: "下载失败：示例书" }],
  );
});

test("summarizeTaskLogs counts each level", () => {
  assert.deepEqual(summarizeTaskLogs(logs), {
    total: 4,
    info: 1,
    warn: 1,
    error: 1,
    success: 1,
  });
});

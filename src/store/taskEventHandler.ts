import dayjs from "dayjs";
import type { TaskRecord, TaskEvent, LogEntry } from "@/types";
import { recordRuleUsage } from "@/lib/ruleHealth";

let logId = 0;

export function makeLogEntry(level: LogEntry["level"], message: string): LogEntry {
  return {
    id: ++logId,
    timestamp: dayjs().format("HH:mm:ss"),
    level,
    message,
  };
}

/** Pure function: apply a TaskEvent to a TaskRecord and return updated copy */
export function applyTaskEvent(record: TaskRecord, event: TaskEvent): TaskRecord {
  const r = { ...record };
  switch (event.type) {
    case "scan_start":
      r.status = "scanning";
      r.scan_items = [];
      break;
    case "scan_done":
      // Each site scan completes with new items — accumulate them
      if (event.items && event.items.length > 0) {
        r.scan_items = [...r.scan_items, ...event.items];
      }
      break;
    case "scan_complete":
      r.scan_items = event.items ?? [];
      r.scan_stats = event.stats ?? null;
      r.status = "preview";
      break;
    case "filter_done":
      if (event.stats) {
        r.stats = event.stats;
        r.total = event.stats.final_download;
        r.status = "downloading";
      }
      break;
    case "novel_done":
      r.completed = Math.min(r.completed + 1, Math.max(r.total, r.completed + 1));
      r.success_count += 1;
      if (event.site) recordRuleUsage(event.site, "success");
      break;
    case "novel_error":
      r.completed = Math.min(r.completed + 1, Math.max(r.total, r.completed + 1));
      r.error_count += 1;
      if (event.site) recordRuleUsage(event.site, "error", event.message ?? undefined);
      break;
    case "overall_done":
      r.status = "done";
      r.finished_at = dayjs().format("YYYY-MM-DD HH:mm:ss");
      break;
  }
  return r;
}

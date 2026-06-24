import type { LogEntry } from "@/types";

export type TaskLogLevelFilter = "all" | LogEntry["level"];

export function filterTaskLogs(
  logs: LogEntry[],
  level: TaskLogLevelFilter,
  query: string,
): LogEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return logs.filter((log) => {
    if (level !== "all" && log.level !== level) return false;
    if (!normalizedQuery) return true;
    return (
      log.message.toLowerCase().includes(normalizedQuery) ||
      log.timestamp.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function summarizeTaskLogs(logs: LogEntry[]) {
  return logs.reduce(
    (summary, log) => {
      summary.total += 1;
      summary[log.level] += 1;
      return summary;
    },
    {
      total: 0,
      info: 0,
      warn: 0,
      error: 0,
      success: 0,
    },
  );
}

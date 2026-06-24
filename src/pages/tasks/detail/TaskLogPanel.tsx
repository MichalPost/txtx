import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Search } from "lucide-react";
import { toast } from "sonner";

import type { LogEntry } from "@/types";

import { filterTaskLogs, summarizeTaskLogs, type TaskLogLevelFilter } from "./taskLogUtils";

const FILTERS: { id: TaskLogLevelFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "error", label: "错误" },
  { id: "warn", label: "警告" },
  { id: "success", label: "成功" },
  { id: "info", label: "信息" },
];

export function TaskLogPanel({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [levelFilter, setLevelFilter] = useState<TaskLogLevelFilter>("all");
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [visibleCount, setVisibleCount] = useState(200);
  const deferredQuery = useDeferredValue(query);

  const summary = useMemo(() => summarizeTaskLogs(logs), [logs]);
  const filteredLogs = useMemo(
    () => filterTaskLogs(logs, levelFilter, deferredQuery),
    [logs, levelFilter, deferredQuery],
  );
  const visibleLogs = useMemo(
    () => filteredLogs.slice(Math.max(0, filteredLogs.length - visibleCount)),
    [filteredLogs, visibleCount],
  );

  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [autoScroll, visibleLogs]);

  useEffect(() => {
    setVisibleCount(200);
  }, [deferredQuery, levelFilter, logs.length]);

  const copyVisibleLogs = async () => {
    const content = visibleLogs.map((log) => `[${log.timestamp}] ${log.message}`).join("\n");
    if (!content) {
      toast.error("当前没有可复制的日志");
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      toast.success(`已复制 ${visibleLogs.length} 条日志`);
    } catch (error) {
      toast.error(`复制日志失败：${String(error)}`);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="flex shrink-0 flex-col gap-3 border-b px-3 py-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className="rounded-full px-2.5 py-1"
              style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
            >
              共 {summary.total} 条
            </span>
            {summary.error > 0 && (
              <span
                className="rounded-full px-2.5 py-1"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
              >
                错误 {summary.error}
              </span>
            )}
            {summary.warn > 0 && (
              <span
                className="rounded-full px-2.5 py-1"
                style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
              >
                警告 {summary.warn}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filteredLogs.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + 200)}
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-2)",
                }}
              >
                显示更多
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(event) => setAutoScroll(event.target.checked)}
              />
              自动滚动
            </label>
            <button
              type="button"
              onClick={() => void copyVisibleLogs()}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                background: "var(--color-surface-2)",
              }}
            >
              <Copy className="h-3.5 w-3.5" /> 复制可见日志
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active = levelFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setLevelFilter(filter.id)}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  background: active ? "var(--color-accent-muted)" : "var(--color-surface-2)",
                  color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <label
          className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
        >
          <Search className="h-3.5 w-3.5" style={{ color: "var(--color-text-subtle)" }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索时间或日志内容"
            className="w-full bg-transparent text-xs outline-none"
            style={{ color: "var(--color-text)" }}
            aria-label="搜索任务日志"
          />
        </label>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2 font-mono text-[11px]">
        {logs.length === 0 && (
          <p className="py-4 text-center" style={{ color: "var(--color-text-muted)" }}>
            任务开始后日志会显示在这里
          </p>
        )}
        {logs.length > 0 && visibleLogs.length === 0 && (
          <p className="py-4 text-center" style={{ color: "var(--color-text-muted)" }}>
            没有匹配的日志，试试切换筛选或清空搜索词
          </p>
        )}
        {filteredLogs.length > visibleLogs.length && (
          <p className="px-2 py-1 text-center text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
            当前仅显示最近 {visibleLogs.length} 条匹配日志，共 {filteredLogs.length} 条
          </p>
        )}
        {visibleLogs.map((log) => (
          <div key={log.id} className="flex gap-2 rounded-lg px-2 py-1 leading-relaxed">
            <span className="shrink-0 select-none" style={{ color: "var(--color-text-subtle)" }}>
              {log.timestamp}
            </span>
            <span
              style={{
                color:
                  log.level === "error"
                    ? "var(--color-danger)"
                    : log.level === "warn"
                      ? "var(--color-warning)"
                      : log.level === "success"
                        ? "var(--color-success)"
                        : "var(--color-text-muted)",
              }}
            >
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

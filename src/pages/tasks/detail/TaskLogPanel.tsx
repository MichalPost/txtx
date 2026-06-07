import { useEffect, useRef } from "react";

import type { LogEntry } from "@/types";

export function TaskLogPanel({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever logs change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2 font-mono text-[11px]">
        {logs.length === 0 && (
          <p className="py-4 text-center" style={{ color: "var(--color-text-muted)" }}>
            任务开始后日志会显示在这里
          </p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 leading-relaxed">
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
        {/* Sentinel element for auto-scroll */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

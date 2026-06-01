import { useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect } from "react";
import { useDownloadStore } from "@/store/downloadStore";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { LogEntry } from "@/types";

type LogFilter = "all" | "error" | "success" | "warn";

function LogLine({ entry }: { entry: LogEntry }) {
  const colorMap: Record<LogEntry["level"], string> = {
    info: "var(--color-text-muted)",
    warn: "var(--color-warning)",
    error: "var(--color-danger)",
    success: "var(--color-success)",
  };
  return (
    <div className="flex gap-2 text-xs font-mono leading-5" style={{ color: colorMap[entry.level] }}>
      <span className="shrink-0" style={{ color: "var(--color-text-subtle)" }}>{entry.timestamp}</span>
      <span className="break-all">{entry.message}</span>
    </div>
  );
}

export function LogPanel() {
  const { logs, clearLogs } = useDownloadStore();
  const [filter, setFilter] = useState<LogFilter>("all");
  const logParentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (filter === "all" ? logs : logs.filter((l) => l.level === filter)),
    [logs, filter],
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => logParentRef.current,
    estimateSize: () => 20,
    overscan: 10,
  });

  useEffect(() => {
    if (filter === "all" && filtered.length > 0) {
      virtualizer.scrollToIndex(filtered.length - 1, { behavior: "smooth" });
    }
  }, [filtered.length, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorCount = logs.filter((l) => l.level === "error").length;

  return (
    <Card
      className="flex flex-col min-h-0 h-full"
      title="运行日志"
      actions={
        <div className="flex items-center gap-1">
          {([
            ["all", "全部", "var(--color-text-muted)"],
            ["error", `错误${errorCount > 0 ? ` ${errorCount}` : ""}`, "var(--color-danger)"],
            ["success", "成功", "var(--color-success)"],
          ] as [LogFilter, string, string][]).map(([f, label, color]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
              style={{
                background: filter === f ? "color-mix(in srgb, currentColor 15%, transparent)" : "transparent",
                color: filter === f ? color : "var(--color-text-subtle)",
              }}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-3 mx-1" style={{ background: "var(--color-border)" }} />
          <Button variant="ghost" size="sm" onClick={clearLogs}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      }
    >
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-0.5 min-h-0"
        ref={logParentRef}
        style={{ maxHeight: "calc(100vh - 300px)" }}
      >
        {filtered.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: "var(--color-text-muted)" }}>
            暂无日志
          </p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((item) => (
              <div key={item.key} style={{ position: "absolute", top: item.start, width: "100%" }}>
                <LogLine entry={filtered[item.index]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

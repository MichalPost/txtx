import { CheckCircle, Download, FolderOpen, RotateCcw } from "lucide-react";

import { Button } from "@/components/Button";
import type { TaskRecord } from "@/types";

import { CounterPair } from "./CounterPair";
import { TaskStats } from "./TaskStats";
import { buildFailedLogReport } from "./taskDetailUtils";

export function DoneView({
  task,
  onRetry,
  failedMessages,
  recentFailedMessages,
  onOpenDir,
  retryPending = false,
}: {
  task: TaskRecord;
  onRetry: () => void;
  failedMessages: string[];
  recentFailedMessages: string[];
  onOpenDir?: () => void;
  retryPending?: boolean;
}) {
  const exportFailedReport = () => {
    const content = buildFailedLogReport(task, failedMessages);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-${task.id.slice(0, 8)}-failed-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-3">
        <CheckCircle className="h-7 w-7 shrink-0" style={{ color: "var(--color-success)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            下载完成
          </p>
          {task.finished_at && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {task.finished_at}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {task.error_count > 0 && (
            <Button variant="secondary" size="sm" onClick={onRetry} disabled={retryPending}>
              <RotateCcw className="h-3.5 w-3.5" /> {retryPending ? "重试中..." : "重试失败"}
            </Button>
          )}
          {failedMessages.length > 0 && (
            <button
              onClick={exportFailedReport}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                background: "var(--color-surface-2)",
              }}
            >
              <Download className="h-3.5 w-3.5" /> 导出失败日志
            </button>
          )}
          {onOpenDir && (
            <Button variant="secondary" size="sm" onClick={onOpenDir} title="打开保存目录" disabled={retryPending}>
              <FolderOpen className="h-3.5 w-3.5" /> 打开目录
            </Button>
          )}
        </div>
      </div>
      <CounterPair success={task.success_count} error={task.error_count} total={task.total} />
      {(task.stats ?? task.scan_stats) && <TaskStats stats={(task.stats ?? task.scan_stats)!} />}
      {recentFailedMessages.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                最近失败摘要
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                已保留最近 {recentFailedMessages.length} 条不同的失败信息，便于快速排查。
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              {task.error_count} 个失败
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {recentFailedMessages.map((message) => (
              <div
                key={message}
                className="rounded-lg px-3 py-2 text-xs leading-relaxed"
                style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
              >
                {message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { AlertCircle, Download, RotateCcw } from "lucide-react";

import { Button } from "@/components/Button";
import type { TaskRecord } from "@/types";

import { buildFailedLogReport } from "./taskDetailUtils";

export function FailedView({
  task,
  onRetry,
  failedMessages,
  recentFailedMessages,
  retryPending = false,
}: {
  task: TaskRecord;
  onRetry: () => void;
  failedMessages: string[];
  recentFailedMessages: string[];
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
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-8 w-8 shrink-0" style={{ color: "var(--color-danger)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            任务失败
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            可直接重试，也可以先导出失败报告，把任务元信息和错误日志一起留档排查。
          </p>
        </div>
      </div>
      {task.error_message && (
        <pre
          className="max-h-40 w-full max-w-full overflow-auto rounded-lg px-3 py-2 text-left text-xs break-words whitespace-pre-wrap"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          {task.error_message}
        </pre>
      )}
      {recentFailedMessages.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            最近失败日志
          </p>
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
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={retryPending}>
          <RotateCcw className="h-3.5 w-3.5" /> {retryPending ? "重试中..." : "重试"}
        </Button>
        {failedMessages.length > 0 && (
          <button
            onClick={exportFailedReport}
            disabled={retryPending}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "var(--color-surface-2)",
            }}
          >
            <Download className="h-3.5 w-3.5" /> 导出失败报告
          </button>
        )}
      </div>
    </div>
  );
}

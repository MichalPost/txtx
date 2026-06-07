import { CheckCircle, Download, FolderOpen, RotateCcw } from "lucide-react";

import { Button } from "@/components/Button";
import type { TaskRecord } from "@/types";

import { CounterPair } from "./CounterPair";
import { TaskStats } from "./TaskStats";

export function DoneView({
  task,
  onRetry,
  failedMessages,
  onOpenDir,
}: {
  task: TaskRecord;
  onRetry: () => void;
  failedMessages: string[];
  onOpenDir?: () => void;
}) {
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
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" /> 重试失败
            </Button>
          )}
          {failedMessages.length > 0 && (
            <button
              onClick={() => {
                const content = failedMessages.join("\n");
                const blob = new Blob([content], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `failed-${task.id.slice(0, 8)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
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
            <Button variant="secondary" size="sm" onClick={onOpenDir} title="打开保存目录">
              <FolderOpen className="h-3.5 w-3.5" /> 打开目录
            </Button>
          )}
        </div>
      </div>
      <CounterPair success={task.success_count} error={task.error_count} total={task.total} />
      {(task.stats ?? task.scan_stats) && <TaskStats stats={(task.stats ?? task.scan_stats)!} />}
    </div>
  );
}

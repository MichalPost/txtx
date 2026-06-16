import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { animateFadeIn } from "@/lib/animations";
import { apiOpenOutputDir } from "@/lib/api";
import { formatTaskActionError } from "@/lib/taskActionError";
import { formatTaskRetryError } from "@/lib/taskRetryError";
import { formatToolActionError } from "@/lib/toolActionError";
import { useTaskStore } from "@/store/taskStore";

import { DoneView } from "./detail/DoneView";
import { DownloadingView } from "./detail/DownloadingView";
import { EmptyState } from "./detail/EmptyState";
import { FailedView } from "./detail/FailedView";
import { ScanPreviewPanel } from "./detail/ScanPreviewPanel";
import { TaskLogPanel } from "./detail/TaskLogPanel";

export function TaskDetailPanel() {
  const { tasks, activeTaskId, getActiveLogs, confirmDownload, retryTask } = useTaskStore();
  const task = tasks.find((t) => t.id === activeTaskId);
  const logs = getActiveLogs();
  const contentRef = useRef<HTMLDivElement>(null);

  // Fade content in whenever the active task changes
  useEffect(() => {
    if (task && contentRef.current) {
      animateFadeIn(contentRef.current);
    }
  }, [activeTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return <EmptyState />;

  const handleConfirm = (selectedUrls: string[]) => {
    const candidates = task.scan_items
      .filter((i) => selectedUrls.includes(i.url))
      .map((i) => ({ name: i.name, url: i.url, crawler_domain: i.site, date: i.date }));
    void confirmDownload(task.id, candidates).catch((error) => {
      toast.error(formatTaskActionError("确认下载任务", error));
    });
  };

  const handleRetry = () => {
    void retryTask(task.id).catch((error) => {
      toast.error(formatTaskRetryError(error));
    });
  };

  const handleOpenOutputDir = () => {
    void apiOpenOutputDir().catch((error) => {
      toast.error(formatToolActionError("打开输出目录", error));
    });
  };

  const failedMessages = logs.filter((l) => l.level === "error").map((l) => l.message);

  const statusColor =
    task.status === "done"
      ? "var(--color-success)"
      : task.status === "failed"
        ? "var(--color-danger)"
        : task.status === "scanning" || task.status === "downloading"
          ? "var(--color-accent)"
          : "var(--color-text-muted)";

  return (
    <div ref={contentRef} className="flex h-full min-h-0 flex-col">
      {/* Task header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(task.status === "scanning" || task.status === "downloading") && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin"
            style={{ color: "var(--color-accent)" }}
          />
        )}
        {task.status === "done" && (
          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "var(--color-success)" }} />
        )}
        {task.status === "failed" && (
          <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--color-danger)" }} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {task.label}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {task.created_at}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium" style={{ color: statusColor }}>
          {task.status === "scanning"
            ? "扫描中"
            : task.status === "downloading"
              ? "下载中"
              : task.status === "preview"
                ? "待确认"
                : task.status === "done"
                  ? "完成"
                  : task.status === "failed"
                    ? "失败"
                    : task.status === "paused"
                      ? "已暂停"
                      : task.status === "cancelled"
                        ? "已取消"
                        : task.status}
        </span>
      </div>

      {/* Content: preview takes full width; others split left + right */}
      {task.status === "preview" ? (
        <div className="flex min-h-0 flex-1 gap-0">
          <div className="min-h-0 flex-1 overflow-hidden">
            <ScanPreviewPanel items={task.scan_items} onConfirm={handleConfirm} />
          </div>
          <div
            className="flex min-h-0 w-72 shrink-0 flex-col border-l"
            style={{ borderColor: "var(--color-border)" }}
          >
            <TaskLogPanel logs={logs} />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Left status panel */}
          <div
            className="w-72 shrink-0 overflow-y-auto border-r"
            style={{ borderColor: "var(--color-border)" }}
          >
            {task.status === "scanning" && (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                <Loader2
                  className="h-8 w-8 animate-spin"
                  style={{ color: "var(--color-accent)" }}
                />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  正在扫描，请稍候
                </p>
                {task.scan_items.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                    已找到 {task.scan_items.length} 本
                  </p>
                )}
              </div>
            )}
            {(task.status === "downloading" || task.status === "paused") && (
              <DownloadingView task={task} />
            )}
            {task.status === "done" && (
              <DoneView
                task={task}
                onRetry={handleRetry}
                failedMessages={failedMessages}
                onOpenDir={handleOpenOutputDir}
              />
            )}
            {task.status === "failed" && <FailedView task={task} onRetry={handleRetry} />}
            {(task.status === "cancelled" || task.status === "queued") && (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {task.status === "cancelled" ? "已取消" : "排队中，等待执行"}
                </p>
              </div>
            )}
          </div>

          {/* Right log panel */}
          <div className="flex min-h-0 flex-1 flex-col">
            <TaskLogPanel logs={logs} />
          </div>
        </div>
      )}
    </div>
  );
}

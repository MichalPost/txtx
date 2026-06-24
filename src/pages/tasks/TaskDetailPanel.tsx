import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, ChevronLeft, Loader2 } from "lucide-react";
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
import { getRecentFailureMessages } from "./detail/taskDetailUtils";

interface TaskDetailPanelProps {
  onBackToList?: () => void;
}

export function TaskDetailPanel({ onBackToList }: TaskDetailPanelProps) {
  const { tasks, activeTaskId, getActiveLogs, confirmDownload, retryTask } = useTaskStore();
  const task = tasks.find((t) => t.id === activeTaskId);
  const logs = getActiveLogs();
  const contentRef = useRef<HTMLDivElement>(null);
  const [mobileSection, setMobileSection] = useState<"primary" | "logs">("primary");
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [retryPending, setRetryPending] = useState(false);

  // Fade content in whenever the active task changes
  useEffect(() => {
    if (task && contentRef.current) {
      animateFadeIn(contentRef.current);
    }
  }, [activeTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMobileSection("primary");
  }, [activeTaskId]);

  useEffect(() => {
    setConfirmPending(false);
    setConfirmError("");
    setRetryPending(false);
  }, [activeTaskId]);

  if (!task) return <EmptyState />;

  const handleConfirm = (selectedUrls: string[]) => {
    if (confirmPending) return;
    const candidates = task.scan_items
      .filter((i) => selectedUrls.includes(i.url))
      .map((i) => ({ name: i.name, url: i.url, crawler_domain: i.site, date: i.date }));
    setConfirmPending(true);
    setConfirmError("");
    void confirmDownload(task.id, candidates)
      .catch((error) => {
        const message = formatTaskActionError("确认下载任务", error);
        setConfirmError(message);
        toast.error(message);
      })
      .finally(() => {
        setConfirmPending(false);
      });
  };

  const handleRetry = () => {
    if (retryPending) return;
    setRetryPending(true);
    void retryTask(task.id)
      .then((taskId) => {
        if (!taskId) {
          toast.error("当前任务缺少可重试的来源信息，请回到下载页重新发起任务");
          return;
        }
        toast.success("已创建重试任务");
      })
      .catch((error) => {
        toast.error(formatTaskRetryError(error));
      })
      .finally(() => {
        setRetryPending(false);
      });
  };

  const handleOpenOutputDir = () => {
    void apiOpenOutputDir().catch((error) => {
      toast.error(formatToolActionError("打开输出目录", error));
    });
  };

  const failedMessages = logs
    .filter((log) => log.level === "error")
    .map((log) => log.message)
    .filter(Boolean);
  const recentFailedMessages = getRecentFailureMessages(logs);

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
        className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3"
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

      <div
        className="flex shrink-0 gap-2 border-b px-4 py-2 lg:hidden"
        style={{ borderColor: "var(--color-border)" }}
      >
        <button
          type="button"
          className="rounded-md border px-2 py-2 text-sm transition-colors"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          onClick={() => onBackToList?.()}
          aria-label="返回任务列表"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
          style={{
            borderColor:
              mobileSection === "primary" ? "var(--color-accent)" : "var(--color-border)",
            color:
              mobileSection === "primary" ? "var(--color-accent)" : "var(--color-text-muted)",
            backgroundColor:
              mobileSection === "primary"
                ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                : "transparent",
          }}
          onClick={() => setMobileSection("primary")}
        >
          {task.status === "preview" ? "预览内容" : "任务状态"}
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
          style={{
            borderColor: mobileSection === "logs" ? "var(--color-accent)" : "var(--color-border)",
            color: mobileSection === "logs" ? "var(--color-accent)" : "var(--color-text-muted)",
            backgroundColor:
              mobileSection === "logs"
                ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                : "transparent",
          }}
          onClick={() => setMobileSection("logs")}
        >
          运行日志
        </button>
      </div>

      {/* Content: preview takes full width; others split left + right */}
      {task.status === "preview" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
          <div
            className={[
              "min-h-0 flex-1 overflow-hidden",
              mobileSection === "primary" ? "block" : "hidden",
              "lg:block",
            ].join(" ")}
          >
            <ScanPreviewPanel
              taskId={task.id}
              items={task.scan_items}
              onConfirm={handleConfirm}
              confirmPending={confirmPending}
              confirmError={confirmError}
            />
          </div>
          <div
            className={[
              "min-h-0 flex-1 flex-col border-t lg:flex lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-l",
              mobileSection === "logs" ? "flex" : "hidden",
            ].join(" ")}
            style={{ borderColor: "var(--color-border)" }}
          >
            <TaskLogPanel logs={logs} />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Left status panel */}
          <div
            className={[
              "min-h-0 flex-1 overflow-y-auto border-b lg:w-80 lg:shrink-0 lg:flex-none lg:border-r lg:border-b-0",
              mobileSection === "primary" ? "block" : "hidden",
              "lg:block",
            ].join(" ")}
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
                recentFailedMessages={recentFailedMessages}
                onOpenDir={handleOpenOutputDir}
                retryPending={retryPending}
              />
            )}
            {task.status === "failed" && (
              <FailedView
                task={task}
                onRetry={handleRetry}
                failedMessages={failedMessages}
                recentFailedMessages={recentFailedMessages}
                retryPending={retryPending}
              />
            )}
            {(task.status === "cancelled" || task.status === "queued") && (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {task.status === "cancelled" ? "已取消" : "排队中，等待执行"}
                </p>
              </div>
            )}
          </div>

          {/* Right log panel */}
          <div
            className={[
              "min-h-0 flex-1 flex-col",
              mobileSection === "logs" ? "flex" : "hidden",
              "lg:flex",
            ].join(" ")}
          >
            <TaskLogPanel logs={logs} />
          </div>
        </div>
      )}
    </div>
  );
}

import { Pause, RotateCcw, Square, Trash2 } from "lucide-react";

import type { TaskRecord } from "@/types";
import { getTaskRetryAction } from "./detail/taskDetailUtils";

interface Props {
  task: TaskRecord;
  isActive: boolean;
  pendingAction?: "cancel" | "pause" | "delete" | "retry" | "confirm" | null;
  onSelect: () => void;
  onCancel: () => void;
  onPause: () => void;
  onDelete: () => void;
  onRetry: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  scanning: "var(--color-warning)",
  downloading: "var(--color-accent)",
  preview: "var(--color-accent)",
  done: "var(--color-success)",
  failed: "var(--color-danger)",
  cancelled: "var(--color-text-muted)",
  paused: "var(--color-warning)",
  queued: "var(--color-text-muted)",
};

const STATUS_LABEL: Record<string, string> = {
  scanning: "扫描中",
  downloading: "下载中",
  preview: "待确认",
  done: "完成",
  failed: "失败",
  cancelled: "已取消",
  paused: "已暂停",
  queued: "排队中",
};

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--color-border)" strokeWidth="2.5" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
        strokeLinecap="round"
        transform="rotate(-90 14 14)"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

export function TaskListItem({
  task,
  isActive,
  pendingAction = null,
  onSelect,
  onCancel,
  onPause,
  onDelete,
  onRetry,
}: Props) {
  const color = STATUS_COLOR[task.status] ?? "var(--color-text-muted)";
  const pct = task.total > 0 ? Math.round((task.completed / task.total) * 100) : 0;
  const isRunning = task.status === "scanning" || task.status === "downloading";
  const isScanning = task.status === "scanning";
  const isDone = task.status === "done" || task.status === "failed" || task.status === "cancelled";
  const isBusy = pendingAction !== null;
  const retryAction = getTaskRetryAction(task);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-all"
      style={{
        background: isActive ? "var(--color-accent-muted)" : "var(--color-surface)",
        borderColor: isActive
          ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
          : "var(--color-border)",
        opacity: isBusy ? 0.78 : 1,
      }}
      aria-pressed={isActive}
      aria-label={`${task.label}，${STATUS_LABEL[task.status] ?? task.status}`}
    >
      {/* Scanning: spinning arc instead of progress ring */}
      {isScanning ? (
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          className="shrink-0 animate-spin"
          style={{ animationDuration: "1.5s" }}
        >
          <circle
            cx="14"
            cy="14"
            r="10"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="2.5"
          />
          <circle
            cx="14"
            cy="14"
            r="10"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray="20 43"
            strokeLinecap="round"
            transform="rotate(-90 14 14)"
          />
        </svg>
      ) : (
        <ProgressRing pct={pct} color={color} />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium" style={{ color: "var(--color-text)" }}>
          {task.label}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[10px] font-medium" style={{ color }}>
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
          {task.total > 0 && (
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {task.completed}/{task.total}
            </span>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {isRunning && task.status === "downloading" && (
          <button
            type="button"
            onClick={onPause}
            disabled={isBusy}
            className="rounded p-1 hover:bg-[var(--color-surface-2)]"
            title={pendingAction === "pause" ? "暂停中..." : "暂停"}
            aria-label={pendingAction === "pause" ? "暂停中" : "暂停任务"}
          >
            <Pause className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
          </button>
        )}
        {isRunning && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded p-1 hover:bg-[var(--color-surface-2)]"
            title={pendingAction === "cancel" ? "取消中..." : "取消"}
            aria-label={pendingAction === "cancel" ? "取消中" : "取消任务"}
          >
            <Square className="h-3 w-3" style={{ color: "var(--color-danger)" }} />
          </button>
        )}
        {(isDone || task.status === "paused") && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isBusy || !retryAction.canRun}
            className="rounded p-1 hover:bg-[var(--color-surface-2)]"
            title={
              retryAction.canRun
                ? pendingAction === "retry"
                  ? retryAction.pendingLabel
                  : retryAction.idleLabel
                : retryAction.unavailableReason
            }
            aria-label={
              retryAction.canRun
                ? pendingAction === "retry"
                  ? retryAction.pendingLabel
                  : retryAction.idleLabel
                : retryAction.unavailableReason
            }
          >
            <RotateCcw className="h-3 w-3" style={{ color: "var(--color-accent)" }} />
          </button>
        )}
        {(isDone || task.status === "paused") && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isBusy}
            className="rounded p-1 hover:bg-[var(--color-surface-2)]"
            title={
              pendingAction === "confirm"
                ? "等待确认..."
                : pendingAction === "delete"
                  ? "删除中..."
                  : "删除"
            }
            aria-label={
              pendingAction === "confirm"
                ? "等待确认"
                : pendingAction === "delete"
                  ? "删除中"
                  : "删除任务"
            }
          >
            <Trash2 className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
          </button>
        )}
      </div>
    </div>
  );
}

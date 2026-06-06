import { Square, Pause, RotateCcw, Trash2 } from "lucide-react";
import type { TaskRecord } from "@/types";

interface Props {
  task: TaskRecord;
  isActive: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onPause: () => void;
  onDelete: () => void;
  onRetry: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  scanning:    "var(--color-warning)",
  downloading: "var(--color-accent)",
  preview:     "var(--color-accent)",
  done:        "var(--color-success)",
  failed:      "var(--color-danger)",
  cancelled:   "var(--color-text-muted)",
  paused:      "var(--color-warning)",
  queued:      "var(--color-text-muted)",
};

const STATUS_LABEL: Record<string, string> = {
  scanning:    "扫描中",
  downloading: "下载中",
  preview:     "待确认",
  done:        "完成",
  failed:      "失败",
  cancelled:   "已取消",
  paused:      "已暂停",
  queued:      "排队中",
};

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
      <circle cx="14" cy="14" r={r} fill="none"
        stroke="var(--color-border)" strokeWidth="2.5" />
      <circle
        cx="14" cy="14" r={r} fill="none"
        stroke={color} strokeWidth="2.5"
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
  task, isActive, onSelect, onCancel, onPause, onDelete, onRetry,
}: Props) {
  const color = STATUS_COLOR[task.status] ?? "var(--color-text-muted)";
  const pct = task.total > 0 ? Math.round((task.completed / task.total) * 100) : 0;
  const isRunning = task.status === "scanning" || task.status === "downloading";
  const isScanning = task.status === "scanning";
  const isDone = task.status === "done" || task.status === "failed" || task.status === "cancelled";

  return (
    <div
      onClick={onSelect}
      className="group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer border transition-all"
      style={{
        background: isActive
          ? "var(--color-accent-muted)"
          : "var(--color-surface)",
        borderColor: isActive ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "var(--color-border)",
      }}
    >
      {/* Scanning: spinning arc instead of progress ring */}
      {isScanning ? (
        <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0 animate-spin"
          style={{ animationDuration: "1.5s" }}>
          <circle cx="14" cy="14" r="10" fill="none" stroke="var(--color-border)" strokeWidth="2.5" />
          <circle cx="14" cy="14" r="10" fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray="20 43" strokeLinecap="round"
            transform="rotate(-90 14 14)" />
        </svg>
      ) : (
        <ProgressRing pct={pct} color={color} />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
          {task.label}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
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
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {isRunning && task.status === "downloading" && (
          <button onClick={onPause}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]" title="暂停">
            <Pause className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
          </button>
        )}
        {isRunning && (
          <button onClick={onCancel}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]" title="取消">
            <Square className="w-3 h-3" style={{ color: "var(--color-danger)" }} />
          </button>
        )}
        {isDone && (
          <button onClick={onRetry}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]" title="重试">
            <RotateCcw className="w-3 h-3" style={{ color: "var(--color-accent)" }} />
          </button>
        )}
        {(isDone || task.status === "paused") && (
          <button onClick={onDelete}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]" title="删除">
            <Trash2 className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
          </button>
        )}
      </div>
    </div>
  );
}

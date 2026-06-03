import { useState } from "react";
import { CheckCircle, AlertCircle, Loader2, FileText, RotateCcw } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { Button } from "@/components/Button";
import type { TaskRecord, LogEntry, DownloadStats, ScanItem } from "@/types";

// ─── Stats grid ───────────────────────────────────────────────────────────────

function TaskStats({ stats }: { stats: DownloadStats }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          ["收集", stats.total_collected, "var(--color-text-muted)"],
          ["黑名单", stats.blacklist_filtered, "var(--color-warning)"],
          ["已存在", stats.local_exists, "var(--color-text-muted)"],
          ["待下载", stats.final_download, "var(--color-accent)"],
        ] as [string, number, string][]
      ).map(([label, val, color]) => (
        <div
          key={label}
          className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
          <span className="text-lg font-bold tabular-nums" style={{ color }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Counter pair ─────────────────────────────────────────────────────────────

function CounterPair({ success, error, total }: { success: number; error: number; total?: number }) {
  return (
    <div className="flex gap-3">
      <div className="px-3 py-2 rounded-lg border"
           style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>成功</p>
        <p className="text-xl font-bold" style={{ color: "var(--color-success)" }}>{success}</p>
      </div>
      <div className="px-3 py-2 rounded-lg border"
           style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>失败</p>
        <p className="text-xl font-bold" style={{ color: "var(--color-danger)" }}>{error}</p>
      </div>
      {total !== undefined && (
        <div className="px-3 py-2 rounded-lg border"
             style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>合计</p>
          <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>{total}</p>
        </div>
      )}
    </div>
  );
}

// ─── Downloading panel ────────────────────────────────────────────────────────

function DownloadingView({ task }: { task: TaskRecord }) {
  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {task.total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
            <span>总进度</span>
            <span>{task.completed}/{task.total}</span>
          </div>
          <AnimatedProgressBar value={task.completed} total={task.total} />
        </div>
      )}
      {(task.stats ?? task.scan_stats) && (
        <TaskStats stats={(task.stats ?? task.scan_stats)!} />
      )}
      <CounterPair success={task.success_count} error={task.error_count} />
    </div>
  );
}

// ─── Done panel ───────────────────────────────────────────────────────────────

function DoneView({ task, onRetry }: { task: TaskRecord; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-7 h-7 shrink-0" style={{ color: "var(--color-success)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>下载完成</p>
          {task.finished_at && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{task.finished_at}</p>
          )}
        </div>
        {task.error_count > 0 && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCcw className="w-3.5 h-3.5" /> 重试失败
          </Button>
        )}
      </div>
      <CounterPair success={task.success_count} error={task.error_count} total={task.total} />
      {(task.stats ?? task.scan_stats) && (
        <TaskStats stats={(task.stats ?? task.scan_stats)!} />
      )}
    </div>
  );
}

// ─── Failed panel ─────────────────────────────────────────────────────────────

function FailedView({ task, onRetry }: { task: TaskRecord; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-4 items-center justify-center h-full">
      <AlertCircle className="w-10 h-10" style={{ color: "var(--color-danger)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>任务失败</p>
      {task.error_message && (
        <p
          className="text-xs text-center max-w-sm px-3 py-2 rounded-lg"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          {task.error_message}
        </p>
      )}
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCcw className="w-3.5 h-3.5" /> 重试
      </Button>
    </div>
  );
}

// ─── Log panel ────────────────────────────────────────────────────────────────

function TaskLogPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] flex flex-col gap-0.5">
        {logs.length === 0 && (
          <p className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
            等待日志...
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
                  log.level === "error" ? "var(--color-danger)"
                  : log.level === "warn" ? "var(--color-warning)"
                  : log.level === "success" ? "var(--color-success)"
                  : "var(--color-text-muted)",
              }}
            >
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scan preview panel ───────────────────────────────────────────────────────

function ScanPreviewPanel({
  items,
  onConfirm,
}: {
  items: ScanItem[];
  onConfirm: (selected: string[]) => void;
}) {
  const eligible = items.filter((i) => !i.excluded_reason);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(eligible.map((i) => i.url))
  );

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          扫描结果 — {eligible.length} 本可下载
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"
            onClick={() => setSelected(new Set())}>全不选</Button>
          <Button variant="secondary" size="sm"
            onClick={() => setSelected(new Set(eligible.map((i) => i.url)))}>全选</Button>
          <Button size="sm" disabled={selected.size === 0}
            onClick={() => onConfirm(Array.from(selected))}>
            下载选中 ({selected.size})
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {items.map((item) => (
          <div
            key={item.url}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              opacity: item.excluded_reason ? 0.5 : 1,
            }}
          >
            {!item.excluded_reason && (
              <input
                type="checkbox"
                checked={selected.has(item.url)}
                onChange={() => toggle(item.url)}
                className="shrink-0 accent-[var(--color-accent)]"
              />
            )}
            {item.excluded_reason && (
              <div className="w-4 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
                {item.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                {item.site} · {item.date}
                {item.excluded_reason && ` · ${item.excluded_reason}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <FileText className="w-10 h-10" style={{ color: "var(--color-text-subtle)" }} />
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        选择一个任务查看详情
      </p>
    </div>
  );
}

// ─── Main detail panel ────────────────────────────────────────────────────────

export function TaskDetailPanel() {
  const { tasks, activeTaskId, getActiveLogs, confirmDownload, retryTask } = useTaskStore();
  const task = tasks.find((t) => t.id === activeTaskId);
  const logs = getActiveLogs();

  if (!task) return <EmptyState />;

  const handleConfirm = (selectedUrls: string[]) => {
    const candidates = task.scan_items
      .filter((i) => selectedUrls.includes(i.url))
      .map((i) => ({ name: i.name, url: i.url, crawler_domain: i.site, date: i.date }));
    confirmDownload(task.id, candidates);
  };

  const statusColor =
    task.status === "done" ? "var(--color-success)"
    : task.status === "failed" ? "var(--color-danger)"
    : task.status === "scanning" || task.status === "downloading"
      ? "var(--color-accent)"
    : "var(--color-text-muted)";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Task header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(task.status === "scanning" || task.status === "downloading") && (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: "var(--color-accent)" }} />
        )}
        {task.status === "done" && (
          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
        )}
        {task.status === "failed" && (
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--color-danger)" }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
            {task.label}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {task.created_at}
          </p>
        </div>
        <span className="text-xs font-medium shrink-0" style={{ color: statusColor }}>
          {task.status === "scanning" ? "扫描中"
           : task.status === "downloading" ? "下载中"
           : task.status === "preview" ? "待确认"
           : task.status === "done" ? "完成"
           : task.status === "failed" ? "失败"
           : task.status === "paused" ? "已暂停"
           : task.status === "cancelled" ? "已取消"
           : task.status}
        </span>
      </div>

      {/* Content: preview takes full width; others split left + right */}
      {task.status === "preview" ? (
        <div className="flex-1 min-h-0 flex gap-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScanPreviewPanel items={task.scan_items} onConfirm={handleConfirm} />
          </div>
          <div
            className="w-72 shrink-0 border-l flex flex-col min-h-0"
            style={{ borderColor: "var(--color-border)" }}
          >
            <TaskLogPanel logs={logs} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left status panel */}
          <div
            className="w-72 shrink-0 overflow-y-auto border-r"
            style={{ borderColor: "var(--color-border)" }}
          >
            {task.status === "scanning" && (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-accent)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>正在扫描站点...</p>
              </div>
            )}
            {(task.status === "downloading" || task.status === "paused") && (
              <DownloadingView task={task} />
            )}
            {task.status === "done" && (
              <DoneView task={task} onRetry={() => retryTask(task.id)} />
            )}
            {task.status === "failed" && (
              <FailedView task={task} onRetry={() => retryTask(task.id)} />
            )}
            {(task.status === "cancelled" || task.status === "queued") && (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {task.status === "cancelled" ? "任务已取消" : "等待执行..."}
                </p>
              </div>
            )}
          </div>

          {/* Right log panel */}
          <div className="flex-1 flex flex-col min-h-0">
            <TaskLogPanel logs={logs} />
          </div>
        </div>
      )}
    </div>
  );
}

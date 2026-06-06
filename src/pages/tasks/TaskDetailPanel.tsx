import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { Button } from "@/components/Button";
import { animateFadeIn } from "@/lib/animations";
import { apiOpenOutputDir } from "@/lib/api";
import { useTaskStore } from "@/store/taskStore";
import type { DownloadStats, LogEntry, ScanItem, TaskRecord } from "@/types";

// ─── Stats grid ───────────────────────────────────────────────────────────────

function TaskStats({ stats }: { stats: DownloadStats }) {
  const items: [string, number, string][] = [
    ["收集", stats.total_collected, "var(--color-text-muted)"],
    ["黑名单", stats.blacklist_filtered, "var(--color-warning)"],
    ["已存在", stats.local_exists, "var(--color-text-muted)"],
    ["待下载", stats.final_download, "var(--color-accent)"],
  ];
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {items.map(([label, val, color], i) => (
        <div
          key={label}
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-1)",
            borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
          }}
        >
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </span>
          <span className="text-sm font-semibold tabular-nums" style={{ color }}>
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Counter pair ─────────────────────────────────────────────────────────────

function CounterPair({
  success,
  error,
  total,
}: {
  success: number;
  error: number;
  total?: number;
}) {
  const items: [string, number, string][] = [
    ["成功", success, "var(--color-success)"],
    ["失败", error, "var(--color-danger)"],
    ...(total !== undefined
      ? [["合计", total, "var(--color-text)"] as [string, number, string]]
      : []),
  ];
  return (
    <div
      className="flex overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {items.map(([label, val, color], i) => (
        <div
          key={label}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3"
          style={{
            background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-1)",
            borderLeft: i > 0 ? "1px solid var(--color-border)" : undefined,
          }}
        >
          <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </span>
          <span className="text-xl font-bold tabular-nums" style={{ color }}>
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Downloading panel ────────────────────────────────────────────────────────

function DownloadingView({ task }: { task: TaskRecord }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {task.total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div
            className="flex justify-between text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>总进度</span>
            <span>
              {task.completed}/{task.total}
            </span>
          </div>
          <AnimatedProgressBar value={task.completed} total={task.total} />
        </div>
      )}
      {(task.stats ?? task.scan_stats) && <TaskStats stats={(task.stats ?? task.scan_stats)!} />}
      <CounterPair success={task.success_count} error={task.error_count} />
    </div>
  );
}

// ─── Done panel ───────────────────────────────────────────────────────────────

function DoneView({
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

// ─── Failed panel ─────────────────────────────────────────────────────────────

function FailedView({ task, onRetry }: { task: TaskRecord; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <AlertCircle className="h-10 w-10" style={{ color: "var(--color-danger)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        任务失败
      </p>
      {task.error_message && (
        <pre
          className="max-h-32 w-full max-w-full overflow-auto rounded-lg px-3 py-2 text-left text-xs break-words whitespace-pre-wrap"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          {task.error_message}
        </pre>
      )}
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" /> 重试
      </Button>
    </div>
  );
}

// ─── Log panel ────────────────────────────────────────────────────────────────

function TaskLogPanel({ logs }: { logs: LogEntry[] }) {
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

// ─── Scan preview panel ───────────────────────────────────────────────────────

type ScanSortKey = "name" | "site" | "date";

function ScanPreviewPanel({
  items,
  onConfirm,
}: {
  items: ScanItem[];
  onConfirm: (selected: string[]) => void;
}) {
  const eligible = items.filter((i) => !i.excluded_reason);
  const [selected, setSelected] = useState<Set<string>>(new Set(eligible.map((i) => i.url)));
  const [siteFilter, setSiteFilter] = useState("");
  const [scanSort, setScanSort] = useState<ScanSortKey>("date");

  // Derive unique sites
  const sites = useMemo(() => [...new Set(items.map((i) => i.site))].sort(), [items]);

  // Filter then sort
  const visible = useMemo(() => {
    const list = siteFilter ? items.filter((i) => i.site === siteFilter) : items;
    const sorted = [...list];
    if (scanSort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    if (scanSort === "site") sorted.sort((a, b) => a.site.localeCompare(b.site));
    if (scanSort === "date") sorted.sort((a, b) => b.date.localeCompare(a.date));
    return sorted;
  }, [items, siteFilter, scanSort]);

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          扫描结果 — {eligible.length} 本可下载
        </p>
        {/* Filters + sort row */}
        <div className="flex flex-wrap items-center gap-2">
          {sites.length > 1 && (
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="rounded-lg border px-2 py-1 text-xs"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              <option value="">全部站点</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <select
            value={scanSort}
            onChange={(e) => setScanSort(e.target.value as ScanSortKey)}
            className="rounded-lg border px-2 py-1 text-xs"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <option value="date">按日期</option>
            <option value="name">按名称</option>
            <option value="site">按站点</option>
          </select>
          <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
            全不选
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelected(new Set(eligible.map((i) => i.url)))}
          >
            全选
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={() => onConfirm(Array.from(selected))}
          >
            下载选中 ({selected.size})
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {visible.map((item) => (
          <div
            key={item.url}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
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
            {item.excluded_reason && <div className="w-4 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" style={{ color: "var(--color-text)" }}>
                {item.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                {item.site}，{item.date}
                {item.excluded_reason && `，${item.excluded_reason}`}
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
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <FileText className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
          选择任务查看详情
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          从左侧选一个任务
        </p>
      </div>
    </div>
  );
}

// ─── Main detail panel ────────────────────────────────────────────────────────

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
    confirmDownload(task.id, candidates);
  };

  const handleRetry = () => {
    void retryTask(task.id);
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
                onOpenDir={() => apiOpenOutputDir().catch((e) => toast.error(String(e)))}
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

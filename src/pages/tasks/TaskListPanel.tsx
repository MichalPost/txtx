import { useState } from "react";
import {
  Clock,
  Cpu,
  Download,
  FileUp,
  Link,
  ListTodo,
  Minus,
  Plus,
  ScanSearch,
  Zap,
} from "lucide-react";

import { Button } from "@/components/Button";
import { ImportUrlPanel } from "@/components/download/ImportUrlPanel";
import { Input } from "@/components/Input";
import { useSchedulerStore } from "@/store/schedulerStore";
import { useTaskStore } from "@/store/taskStore";
import type { DownloadMode, ScanTaskOptions } from "@/types";

import { TaskListItem } from "./TaskListItem";

interface Props {
  onNewScan: (opts: ScanTaskOptions) => void;
  onNewBatch: (opts: ScanTaskOptions) => void;
  onNewSingle: (url: string) => void;
}

// ─── Download mode selector ───────────────────────────────────────────────────

const DOWNLOAD_MODES: {
  mode: DownloadMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    mode: "smart",
    label: "智能模式",
    desc: "优先多线程，出错时自动切回单线程",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "var(--color-accent)",
  },
  {
    mode: "multi",
    label: "多线程",
    desc: "强制多线程，出错次数达到设定值后跳过",
    icon: <Cpu className="h-3.5 w-3.5" />,
    color: "var(--color-warning)",
  },
  {
    mode: "single",
    label: "单线程",
    desc: "速度慢但稳定",
    icon: <Minus className="h-3.5 w-3.5" />,
    color: "var(--color-text-muted)",
  },
];

function DownloadModeSelector({
  value,
  onChange,
}: {
  value: DownloadMode;
  onChange: (m: DownloadMode) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-0.5 text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
        下载方式
      </p>
      <div className="flex flex-col gap-1">
        {DOWNLOAD_MODES.map(({ mode, label, desc, icon, color }) => {
          const active = value === mode;
          return (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
                  : "var(--color-surface)",
                borderColor: active
                  ? "color-mix(in srgb, var(--color-accent) 50%, transparent)"
                  : "var(--color-border)",
              }}
            >
              {/* mode icon + indicator */}
              <span style={{ color: active ? color : "var(--color-text-muted)" }}>{icon}</span>

              <div className="min-w-0 flex-1">
                <p
                  className="mb-0.5 text-xs leading-none font-medium"
                  style={{ color: active ? "var(--color-text)" : "var(--color-text-muted)" }}
                >
                  {label}
                </p>
                <p
                  className="text-[10px] leading-tight"
                  style={{ color: "var(--color-text-subtle)" }}
                >
                  {desc}
                </p>
              </div>

              {/* active dot */}
              <div
                className="h-2 w-2 shrink-0 rounded-full transition-all"
                style={{
                  background: active ? color : "transparent",
                  border: `1.5px solid ${active ? color : "var(--color-border)"}`,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function TaskListPanel({ onNewScan, onNewBatch, onNewSingle }: Props) {
  const { tasks, activeTaskId, setActive, cancelTask, pauseTask, deleteTask, retryTask } =
    useTaskStore();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>("smart");

  const {
    enabled: schedEnabled,
    hour: schedHour,
    toggle: schedToggle,
    setHour: schedSetHour,
  } = useSchedulerStore();

  const running = tasks.filter((t) => t.status === "scanning" || t.status === "downloading").length;

  const modeOpts: ScanTaskOptions = { download_mode: downloadMode };

  return (
    <div
      className="flex h-full flex-col border-r"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-3.5"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            任务列表
          </p>
          {running > 0 && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-accent)" }}>
              {running} 个运行中
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowNewMenu((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> 新建
        </Button>
      </div>

      {/* New task menu */}
      {showNewMenu && (
        <div
          className="flex shrink-0 flex-col gap-3 border-b p-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
        >
          {/* Daily scheduler */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock
                  className="h-3.5 w-3.5"
                  style={{
                    color: schedEnabled ? "var(--color-accent)" : "var(--color-text-muted)",
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  每日自动扫描
                </span>
              </div>
              {/* Simple toggle button */}
              <button
                type="button"
                onClick={schedToggle}
                className="relative h-4 w-8 rounded-full transition-colors"
                style={{
                  background: schedEnabled ? "var(--color-accent)" : "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span
                  className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
                  style={{ left: schedEnabled ? "calc(100% - 14px)" : "2px" }}
                />
              </button>
            </div>
            {schedEnabled && (
              <div className="flex items-center gap-2 pl-5">
                <span className="text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
                  触发时间
                </span>
                <select
                  value={schedHour}
                  onChange={(e) => schedSetHour(Number(e.target.value))}
                  className="rounded border px-1.5 py-0.5 text-xs"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="h-px" style={{ background: "var(--color-border)" }} />

          {/* Download mode selector */}
          <DownloadModeSelector value={downloadMode} onChange={setDownloadMode} />

          {/* Divider */}
          <div className="h-px" style={{ background: "var(--color-border)" }} />

          {/* Task type buttons */}
          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="justify-start"
              onClick={() => {
                onNewScan(modeOpts);
                setShowNewMenu(false);
              }}
            >
              <ScanSearch className="h-3.5 w-3.5" /> 扫描预览
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="justify-start"
              onClick={() => {
                onNewBatch(modeOpts);
                setShowNewMenu(false);
              }}
            >
              <Download className="h-3.5 w-3.5" /> 批量下载
            </Button>
            <div className="flex gap-1">
              <Input
                className="h-7 flex-1 text-xs"
                placeholder="输入小说 URL..."
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && singleUrl.trim()) {
                    onNewSingle(singleUrl.trim());
                    setSingleUrl("");
                    setShowNewMenu(false);
                  }
                }}
              />
              <Button
                size="sm"
                disabled={!singleUrl.trim()}
                onClick={() => {
                  if (singleUrl.trim()) {
                    onNewSingle(singleUrl.trim());
                    setSingleUrl("");
                    setShowNewMenu(false);
                  }
                }}
              >
                <Link className="h-3 w-3" />
              </Button>
            </div>

            {/* Import from file */}
            <button
              className="flex w-full items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
              onClick={() => setShowImportPanel((v) => !v)}
            >
              <FileUp className="h-3.5 w-3.5" />
              从文件批量导入
            </button>
            {showImportPanel && (
              <ImportUrlPanel
                taskMode
                onClose={() => setShowImportPanel(false)}
                onImport={async (urls) => {
                  for (const url of urls) {
                    try {
                      await onNewSingle(url);
                    } catch (e) {
                      console.error("创建任务失败:", url, e);
                    }
                  }
                  setShowImportPanel(false);
                  setShowNewMenu(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {tasks.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
              }}
            >
              <ListTodo className="h-6 w-6" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                还没有任务
              </p>
              <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
                点击「新建」开始
              </p>
            </div>
          </div>
        )}
        {tasks.map((task) => (
          <TaskListItem
            key={task.id}
            task={task}
            isActive={task.id === activeTaskId}
            onSelect={() => setActive(task.id)}
            onCancel={() => cancelTask(task.id)}
            onPause={() => pauseTask(task.id)}
            onDelete={() => deleteTask(task.id)}
            onRetry={() => retryTask(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

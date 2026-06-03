import { useState } from "react";
import { Plus, ScanSearch, Download, Link } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { TaskListItem } from "./TaskListItem";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import type { ScanTaskOptions } from "@/types";

interface Props {
  onNewScan: (opts: ScanTaskOptions) => void;
  onNewBatch: (opts: ScanTaskOptions) => void;
  onNewSingle: (url: string) => void;
}

export function TaskListPanel({ onNewScan, onNewBatch, onNewSingle }: Props) {
  const { tasks, activeTaskId, setActive, cancelTask, pauseTask, deleteTask, retryTask } =
    useTaskStore();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");

  const running = tasks.filter(
    (t) => t.status === "scanning" || t.status === "downloading"
  ).length;

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3 border-b shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
            任务列表
          </p>
          {running > 0 && (
            <p className="text-[10px]" style={{ color: "var(--color-accent)" }}>
              {running} 个运行中
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowNewMenu((v) => !v)}>
          <Plus className="w-3.5 h-3.5" /> 新建
        </Button>
      </div>

      {/* New task menu */}
      {showNewMenu && (
        <div
          className="p-3 border-b flex flex-col gap-2 shrink-0"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
        >
          <Button
            variant="secondary" size="sm" className="justify-start"
            onClick={() => { onNewScan({}); setShowNewMenu(false); }}
          >
            <ScanSearch className="w-3.5 h-3.5" /> 扫描预览
          </Button>
          <Button
            variant="secondary" size="sm" className="justify-start"
            onClick={() => { onNewBatch({}); setShowNewMenu(false); }}
          >
            <Download className="w-3.5 h-3.5" /> 批量下载
          </Button>
          <div className="flex gap-1">
            <Input
              className="flex-1 h-7 text-xs"
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
              <Link className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 p-2">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>暂无任务</p>
            <p className="text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
              点击"新建"创建任务
            </p>
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

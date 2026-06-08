import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/Button";
import { useTaskStore } from "@/store/taskStore";
import type { ScanTaskOptions } from "@/types";

import { NewTaskMenu } from "./list/NewTaskMenu";
import { TaskEmptyState } from "./list/TaskEmptyState";
import { TaskListItem } from "./TaskListItem";

interface Props {
  onNewScan: (opts: ScanTaskOptions) => void;
  onNewBatch: (opts: ScanTaskOptions) => void;
  onNewSingle: (url: string) => void;
}

export function TaskListPanel({ onNewScan, onNewBatch, onNewSingle }: Props) {
  const { tasks, activeTaskId, setActive, cancelTask, pauseTask, deleteTask, retryTask } =
    useTaskStore();
  const [showNewMenu, setShowNewMenu] = useState(false);

  const running = tasks.filter((t) => t.status === "scanning" || t.status === "downloading").length;

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
        <NewTaskMenu
          onNewScan={onNewScan}
          onNewBatch={onNewBatch}
          onNewSingle={onNewSingle}
          onClose={() => setShowNewMenu(false)}
        />
      )}

      {/* Task list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {tasks.length === 0 && <TaskEmptyState />}
        {tasks.map((task) => (
          <TaskListItem
            key={task.id}
            task={task}
            isActive={task.id === activeTaskId}
            onSelect={() => setActive(task.id)}
            onCancel={() => void cancelTask(task.id)}
            onPause={() => void pauseTask(task.id)}
            onDelete={() => void deleteTask(task.id)}
            onRetry={() => void retryTask(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

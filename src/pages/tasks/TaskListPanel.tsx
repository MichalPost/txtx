import { useMemo, useState } from "react";
import { ArrowDownAZ, Clock3, Filter, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { formatTaskActionError } from "@/lib/taskActionError";
import { formatTaskRetryError } from "@/lib/taskRetryError";
import { useTaskStore } from "@/store/taskStore";
import type { ScanTaskOptions } from "@/types";

import { NewTaskMenu } from "./list/NewTaskMenu";
import { TaskEmptyState } from "./list/TaskEmptyState";
import { TaskListItem } from "./TaskListItem";
import {
  buildTaskListSummary,
  deriveTaskListViewState,
  filterAndSortTasks,
  type TaskKindFilter,
  type TaskFilterStatus,
  type TaskSortMode,
} from "./taskListUtils";

interface Props {
  onNewScan: (opts: ScanTaskOptions) => void;
  onNewBatch: (opts: ScanTaskOptions) => void;
  onNewSingle: (url: string) => void;
}

export function TaskListPanel({ onNewScan, onNewBatch, onNewSingle }: Props) {
  const {
    tasks,
    activeTaskId,
    setActive,
    cancelTask,
    pauseTask,
    deleteTask,
    retryTask,
    refreshTasks: reloadTasks,
    pollError,
  } = useTaskStore();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskFilterStatus>("all");
  const [kindFilter, setKindFilter] = useState<TaskKindFilter>("all");
  const [sortMode, setSortMode] = useState<TaskSortMode>("recent_activity");
  const [actionState, setActionState] = useState<Record<string, "cancel" | "pause" | "delete" | "retry" | null>>({});

  const handleTaskActionError = (actionLabel: string, error: unknown) => {
    toast.error(formatTaskActionError(actionLabel, error));
  };

  const summary = useMemo(() => buildTaskListSummary(tasks), [tasks]);
  const visibleTasks = useMemo(
    () =>
      filterAndSortTasks(tasks, {
        search,
        status: statusFilter,
        sort: sortMode,
        kind: kindFilter,
      }),
    [tasks, search, statusFilter, sortMode, kindFilter],
  );
  const viewState = useMemo(
    () =>
      deriveTaskListViewState({
        totalTasks: tasks.length,
        visibleTasks: visibleTasks.length,
        search,
        status: statusFilter,
        pollError,
      }),
    [tasks.length, visibleTasks.length, search, statusFilter, pollError],
  );

  const filterOptions: Array<{ value: TaskFilterStatus; label: string }> = [
    { value: "all", label: "全部" },
    { value: "active", label: "进行中" },
    { value: "queued", label: "待处理" },
    { value: "finished", label: "已结束" },
    { value: "failed", label: "失败" },
  ];

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setKindFilter("all");
  };

  const refreshTasks = async () => {
    try {
      await reloadTasks();
      toast.success("任务列表已刷新");
    } catch (error) {
      toast.error(formatTaskActionError("刷新任务列表", error));
    }
  };

  const runTaskAction = async (
    taskId: string,
    action: "cancel" | "pause" | "delete" | "retry",
    execute: () => Promise<unknown>,
    options?: { confirmMessage?: string; successMessage?: string; errorLabel?: string; useRetryFormatter?: boolean },
  ) => {
    if (actionState[taskId]) return;
    if (options?.confirmMessage && !window.confirm(options.confirmMessage)) return;

    setActionState((current) => ({ ...current, [taskId]: action }));
    try {
      await execute();
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
    } catch (error) {
      if (options?.useRetryFormatter) {
        toast.error(formatTaskRetryError(error));
      } else {
        handleTaskActionError(options?.errorLabel ?? "处理任务", error);
      }
    } finally {
      setActionState((current) => ({ ...current, [taskId]: null }));
    }
  };

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
          {summary.active > 0 ? (
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-accent)" }}>
              {summary.active} 个流程进行中
            </p>
          ) : (
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-subtle)" }}>
              共 {summary.total} 个任务
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

      <div
        className="flex shrink-0 flex-col gap-2 border-b px-3 py-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--color-text-subtle)" }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务名或 URL..."
            className="h-8 pl-8 text-xs"
            aria-label="搜索任务"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={{
                background:
                  statusFilter === option.value
                    ? "color-mix(in srgb, var(--color-accent) 14%, transparent)"
                    : "var(--color-surface)",
                color:
                  statusFilter === option.value
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)",
                border: `1px solid ${
                  statusFilter === option.value
                    ? "color-mix(in srgb, var(--color-accent) 28%, transparent)"
                    : "var(--color-border)"
                }`,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value as TaskKindFilter)}
          className="h-8 rounded-lg border px-2 text-xs"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          aria-label="按任务类型筛选"
        >
          <option value="all">全部类型</option>
          <option value="single_download">单本下载</option>
          <option value="batch_download">批量下载</option>
          <option value="full_scan">扫描任务</option>
          <option value="selected_download">已选下载</option>
        </select>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-text-subtle)" }}>
            <span>失败 {summary.failed}</span>
            <span>待处理 {summary.queued}</span>
            <span>成功率 {summary.successRate}%</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSortMode("recent_activity")}
              className="rounded-lg p-1.5 transition-colors"
              style={{
                background:
                  sortMode === "recent_activity" ? "var(--color-surface)" : "transparent",
                color:
                  sortMode === "recent_activity"
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)",
              }}
              title="按最近活动排序"
              aria-label="按最近活动排序"
            >
              <Clock3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSortMode("label_asc")}
              className="rounded-lg p-1.5 transition-colors"
              style={{
                background: sortMode === "label_asc" ? "var(--color-surface)" : "transparent",
                color:
                  sortMode === "label_asc" ? "var(--color-accent)" : "var(--color-text-muted)",
              }}
              title="按名称排序"
              aria-label="按名称排序"
            >
              <ArrowDownAZ className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSortMode((current) => (current === "created_asc" ? "created_desc" : "created_asc"))
              }
              className="rounded-lg px-2 py-1.5 text-[11px] transition-colors"
              style={{
                background:
                  sortMode === "created_asc" || sortMode === "created_desc"
                    ? "var(--color-surface)"
                    : "transparent",
                color:
                  sortMode === "created_asc" || sortMode === "created_desc"
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)",
              }}
              title={sortMode === "created_asc" ? "按创建时间升序" : "按创建时间降序"}
              aria-label={sortMode === "created_asc" ? "按创建时间升序" : "按创建时间降序"}
            >
              时间
            </button>
          </div>
        </div>
        {pollError ? (
          <div
            className="rounded-lg border px-2.5 py-2 text-[11px]"
            style={{
              borderColor: "color-mix(in srgb, var(--color-danger) 24%, transparent)",
              background: "var(--color-danger-bg)",
              color: "var(--color-danger)",
            }}
          >
            自动刷新失败：{pollError}
          </div>
        ) : null}
      </div>

      {/* Task list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {tasks.length === 0 && (
          <TaskEmptyState
            title={viewState.title}
            description={viewState.description}
            actions={
              <Button size="sm" onClick={() => setShowNewMenu(true)}>
                <Plus className="h-3.5 w-3.5" /> 新建任务
              </Button>
            }
          />
        )}
        {tasks.length > 0 && visibleTasks.length === 0 && (
          <TaskEmptyState
            title={viewState.title}
            description={viewState.description}
            icon={Filter}
            actions={
              <>
                {viewState.showClearFilters ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    清空筛选
                  </Button>
                ) : null}
                {viewState.showRefresh ? (
                  <Button variant="secondary" size="sm" onClick={() => void refreshTasks()}>
                    刷新列表
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => setShowNewMenu(true)}>
                  <Plus className="h-3.5 w-3.5" /> 新建任务
                </Button>
              </>
            }
          />
        )}
        {visibleTasks.map((task) => (
          <TaskListItem
            key={task.id}
            task={task}
            isActive={task.id === activeTaskId}
            pendingAction={actionState[task.id] ?? null}
            onSelect={() => setActive(task.id)}
            onCancel={() =>
              void runTaskAction(task.id, "cancel", () => cancelTask(task.id), {
                successMessage: "任务已取消",
                errorLabel: "取消任务",
              })
            }
            onPause={() =>
              void runTaskAction(task.id, "pause", () => pauseTask(task.id), {
                successMessage: "任务已暂停",
                errorLabel: "暂停任务",
              })
            }
            onDelete={() =>
              void runTaskAction(task.id, "delete", () => deleteTask(task.id), {
                confirmMessage: `确认删除任务「${task.label}」吗？该操作会清除本地任务记录。`,
                successMessage: "任务已删除",
                errorLabel: "删除任务",
              })
            }
            onRetry={() =>
              void runTaskAction(task.id, "retry", async () => {
                const nextTaskId = await retryTask(task.id);
                if (!nextTaskId) {
                  throw new Error("当前任务缺少可重试的来源信息，请重新创建任务");
                }
                setActive(nextTaskId);
                return nextTaskId;
              }, {
                successMessage: "已创建重试任务",
                useRetryFormatter: true,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

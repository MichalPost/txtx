import type { TaskRecord, TaskStatus } from "@/types";

export type TaskFilterStatus = "all" | "active" | "queued" | "finished" | "failed";
export type TaskSortMode = "created_desc" | "created_asc" | "label_asc" | "recent_activity";
export type TaskKindFilter = "all" | TaskRecord["kind"];

export interface TaskListQuery {
  search: string;
  status: TaskFilterStatus;
  sort: TaskSortMode;
  kind?: TaskKindFilter;
}

export interface TaskListSummary {
  total: number;
  active: number;
  queued: number;
  finished: number;
  failed: number;
  successRate: number;
}

export interface TaskListViewState {
  title: string;
  description: string;
  showClearFilters: boolean;
  showRefresh: boolean;
}

export interface BulkTaskActionState {
  disposableTaskIds: string[];
  recoverableTaskIds: string[];
  canDeleteFinished: boolean;
  canRecoverFailed: boolean;
  deleteFinishedLabel: string;
  recoverFailedLabel: string;
}

export interface VisibleTaskWindow {
  tasks: TaskRecord[];
  visibleCount: number;
  hasMore: boolean;
  nextVisibleCount: number;
}

const ACTIVE_STATUSES: TaskStatus[] = ["scanning", "downloading", "preview"];
const QUEUED_STATUSES: TaskStatus[] = ["queued", "paused"];
const FINISHED_STATUSES: TaskStatus[] = ["done", "failed", "cancelled"];
const DISPOSABLE_STATUSES: TaskStatus[] = ["done", "failed", "cancelled"];
const RECOVERABLE_STATUSES: TaskStatus[] = ["failed", "paused"];

function matchesStatus(task: TaskRecord, status: TaskFilterStatus): boolean {
  if (status === "all") return true;
  if (status === "active") return ACTIVE_STATUSES.includes(task.status);
  if (status === "queued") return QUEUED_STATUSES.includes(task.status);
  if (status === "finished") return FINISHED_STATUSES.includes(task.status);
  if (status === "failed") return task.status === "failed";
  return true;
}

function matchesKind(task: TaskRecord, kind?: TaskKindFilter): boolean {
  return !kind || kind === "all" ? true : task.kind === kind;
}

function toSortableTime(task: TaskRecord): number {
  const value = task.finished_at ?? task.created_at;
  const time = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(time) ? 0 : time;
}

function getLifecycleWeight(task: TaskRecord): number {
  if (task.finished_at) return 3;
  if (ACTIVE_STATUSES.includes(task.status)) return 2;
  if (QUEUED_STATUSES.includes(task.status)) return 1;
  return 0;
}

export function filterAndSortTasks(tasks: TaskRecord[], query: TaskListQuery): TaskRecord[] {
  const normalizedSearch = query.search.trim().toLowerCase();

  const filtered = tasks.filter((task) => {
    const matchesKeyword =
      normalizedSearch.length === 0 ||
      task.label.toLowerCase().includes(normalizedSearch) ||
      task.source_url?.toLowerCase().includes(normalizedSearch) ||
      false;

    return matchesKeyword && matchesStatus(task, query.status) && matchesKind(task, query.kind);
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (query.sort === "created_asc") {
      return toSortableTime(a) - toSortableTime(b);
    }
    if (query.sort === "label_asc") {
      return a.label.localeCompare(b.label, "zh-CN");
    }
    if (query.sort === "recent_activity") {
      const lifecycleDiff = getLifecycleWeight(b) - getLifecycleWeight(a);
      if (lifecycleDiff !== 0) return lifecycleDiff;
      return toSortableTime(b) - toSortableTime(a);
    }
    return toSortableTime(b) - toSortableTime(a);
  });

  return sorted;
}

export function buildTaskListSummary(tasks: TaskRecord[]): TaskListSummary {
  const summary = tasks.reduce<TaskListSummary>(
    (summary, task) => {
      summary.total += 1;
      if (ACTIVE_STATUSES.includes(task.status)) summary.active += 1;
      if (QUEUED_STATUSES.includes(task.status) || task.status === "preview") summary.queued += 1;
      if (FINISHED_STATUSES.includes(task.status)) summary.finished += 1;
      if (task.status === "failed") summary.failed += 1;
      return summary;
    },
    { total: 0, active: 0, queued: 0, finished: 0, failed: 0, successRate: 0 },
  );

  const successful = summary.finished - summary.failed;
  summary.successRate =
    summary.finished > 0 ? Math.round((successful / summary.finished) * 100) : 0;

  return summary;
}

export function buildBulkTaskActionState(tasks: TaskRecord[]): BulkTaskActionState {
  const disposableTaskIds = tasks
    .filter((task) => DISPOSABLE_STATUSES.includes(task.status))
    .map((task) => task.id);
  const recoverableTaskIds = tasks.filter(isRecoverableTask).map((task) => task.id);

  return {
    disposableTaskIds,
    recoverableTaskIds,
    canDeleteFinished: disposableTaskIds.length > 0,
    canRecoverFailed: recoverableTaskIds.length > 0,
    deleteFinishedLabel:
      disposableTaskIds.length > 0
        ? `清理 ${disposableTaskIds.length} 个已结束任务`
        : "没有可清理任务",
    recoverFailedLabel:
      recoverableTaskIds.length > 0
        ? `恢复 ${recoverableTaskIds.length} 个失败/暂停任务`
        : "没有可恢复任务",
  };
}

function isRecoverableTask(task: TaskRecord): boolean {
  if (!RECOVERABLE_STATUSES.includes(task.status)) return false;

  if (task.kind === "single_download") {
    return Boolean(task.source_url ?? task.scan_items[0]?.url);
  }

  if (task.kind === "selected_download") {
    return (task.retry_context?.selected_items?.length ?? 0) > 0;
  }

  return task.kind === "batch_download" || task.kind === "full_scan";
}

export function buildVisibleTaskWindow(
  tasks: TaskRecord[],
  visibleCount: number,
  batchSize: number,
): VisibleTaskWindow {
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const safeVisibleCount = Math.min(
    tasks.length,
    Math.max(safeBatchSize, Math.floor(visibleCount)),
  );
  const nextVisibleCount = Math.min(tasks.length, safeVisibleCount + safeBatchSize);

  return {
    tasks: tasks.slice(0, safeVisibleCount),
    visibleCount: safeVisibleCount,
    hasMore: safeVisibleCount < tasks.length,
    nextVisibleCount,
  };
}

export function deriveTaskListViewState(args: {
  totalTasks: number;
  visibleTasks: number;
  search: string;
  status: TaskFilterStatus;
  pollError: string | null;
}): TaskListViewState {
  const hasFilters = args.search.trim().length > 0 || args.status !== "all";

  if (args.totalTasks === 0) {
    return {
      title: "还没有任务",
      description: "新建一个扫描、批量或单本任务后，这里会持续显示进度和结果。",
      showClearFilters: false,
      showRefresh: false,
    };
  }

  if (args.visibleTasks === 0) {
    return {
      title: args.pollError ? "任务列表暂时不可用" : "没有符合条件的任务",
      description: args.pollError
        ? "自动刷新失败了，可以手动刷新一次，或者先清空筛选条件再查看已有任务。"
        : hasFilters
          ? "换个关键词、切换状态筛选，或一键清空筛选后再试。"
          : "当前列表没有可显示的任务，试试手动刷新或新建一个任务。",
      showClearFilters: hasFilters,
      showRefresh: Boolean(args.pollError) || !hasFilters,
    };
  }

  return {
    title: "",
    description: "",
    showClearFilters: false,
    showRefresh: false,
  };
}

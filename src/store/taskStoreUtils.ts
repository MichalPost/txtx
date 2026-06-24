import type { ScanItem, TaskId, TaskRecord, TaskStatus } from "@/types";
import { hasTaskChanged } from "./taskSync.ts";
import type { TaskPreviewDraft } from "@/types";

const RUNNING_TASK_STATUSES: TaskStatus[] = ["scanning", "downloading"];
const MANAGED_TASK_STATUSES: TaskStatus[] = ["queued", "scanning", "preview", "downloading", "paused"];

export function hasRunningTask(tasks: TaskRecord[]) {
  return tasks.some((task) => RUNNING_TASK_STATUSES.includes(task.status));
}

export function hasManagedTask(tasks: TaskRecord[]) {
  return tasks.some((task) => MANAGED_TASK_STATUSES.includes(task.status));
}

export function buildDefaultPreviewDraft(
  items: ScanItem[],
  existing?: TaskPreviewDraft,
): TaskPreviewDraft {
  if (existing) return existing;

  const eligibleCount = items.filter((item) => !item.excluded_reason).length;
  return {
    deselected_urls: [],
    site_filter: "",
    scan_sort: "date",
    visible_count: Math.max(100, Math.min(eligibleCount || items.length || 100, 100)),
  };
}

export function mergeTaskSnapshots(
  existingTasks: TaskRecord[],
  freshTasks: TaskRecord[],
  activeTaskId: TaskId | null,
) {
  const freshMap = new Map(freshTasks.map((task) => [task.id, task]));
  const orderedTasks = existingTasks
    .map((task) => {
      const serverTask = freshMap.get(task.id);
      if (!serverTask) return null;
      return hasTaskChanged(task, serverTask) ? serverTask : task;
    })
    .filter((task): task is TaskRecord => Boolean(task));

  for (const task of freshTasks) {
    if (!existingTasks.some((existing) => existing.id === task.id)) {
      orderedTasks.push(task);
    }
  }

  const nextActiveTaskId = orderedTasks.some((task) => task.id === activeTaskId)
    ? activeTaskId
    : (orderedTasks[0]?.id ?? null);

  return {
    tasks: orderedTasks,
    activeTaskId: nextActiveTaskId,
  };
}

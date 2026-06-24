import type {
  BookCandidate,
  ScanTaskOptions,
  TaskId,
  TaskPreviewDraft,
  TaskRecord,
} from "@/types";
import { invokeDesktopCommand } from "@/platform";

import { API_BASE, IS_TAURI } from "./constants";

export async function apiCreateScanTask(options?: ScanTaskOptions): Promise<TaskId> {
  if (IS_TAURI) {
    return invokeDesktopCommand<TaskId>("create_scan_task", { options: options ?? null });
  }
  const res = await fetch(`${API_BASE}/api/tasks/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.task_id;
}

export async function apiCreateBatchDownloadTask(options?: ScanTaskOptions): Promise<TaskId> {
  if (IS_TAURI) {
    return invokeDesktopCommand<TaskId>("create_batch_download_task", { options: options ?? null });
  }
  const res = await fetch(`${API_BASE}/api/tasks/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.task_id;
}

export async function apiCreateSingleDownloadTask(url: string): Promise<TaskId> {
  if (IS_TAURI) {
    return invokeDesktopCommand<TaskId>("create_single_download_task", { url });
  }
  const res = await fetch(`${API_BASE}/api/tasks/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.task_id;
}

export async function apiCreateSelectedDownloadTask(selected: BookCandidate[]): Promise<TaskId> {
  if (IS_TAURI) {
    return invokeDesktopCommand<TaskId>("create_selected_download_task", { selected });
  }
  const res = await fetch(`${API_BASE}/api/tasks/selected`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selected),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.task_id;
}

export async function apiConfirmTaskDownload(
  taskId: TaskId,
  selected: BookCandidate[],
): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("confirm_task_download", { taskId, selected });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selected),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiListTasks(): Promise<TaskRecord[]> {
  if (IS_TAURI) {
    return invokeDesktopCommand<TaskRecord[]>("list_tasks");
  }
  const res = await fetch(`${API_BASE}/api/tasks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiGetTask(taskId: TaskId): Promise<TaskRecord | null> {
  if (IS_TAURI) {
    return invokeDesktopCommand<TaskRecord | null>("get_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiCancelTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("cancel_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}/cancel`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiPauseTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("pause_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}/pause`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiDeleteTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("delete_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiLoadPersistedTasks(): Promise<TaskRecord[]> {
  if (IS_TAURI) {
    return invokeDesktopCommand<TaskRecord[]>("load_persisted_tasks");
  }
  return [];
}

export async function apiUpdateTaskPreviewDraft(
  taskId: TaskId,
  draft: TaskPreviewDraft,
): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("update_task_preview_draft", { taskId, draft });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}/preview-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error(await res.text());
}

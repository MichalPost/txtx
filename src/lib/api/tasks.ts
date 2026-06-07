import type { BookCandidate, ScanTaskOptions, TaskId, TaskRecord } from "@/types";

import { API_BASE, IS_TAURI } from "./constants";

export async function apiCreateScanTask(options?: ScanTaskOptions): Promise<TaskId> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskId>("create_scan_task", { options: options ?? null });
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
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskId>("create_batch_download_task", { options: options ?? null });
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
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskId>("create_single_download_task", { url });
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

export async function apiConfirmTaskDownload(
  taskId: TaskId,
  selected: BookCandidate[],
): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("confirm_task_download", { taskId, selected });
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
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskRecord[]>("list_tasks");
  }
  const res = await fetch(`${API_BASE}/api/tasks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiGetTask(taskId: TaskId): Promise<TaskRecord | null> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskRecord | null>("get_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiCancelTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("cancel_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}/cancel`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiPauseTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("pause_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}/pause`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiDeleteTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("delete_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiLoadPersistedTasks(): Promise<TaskRecord[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskRecord[]>("load_persisted_tasks");
  }
  return [];
}

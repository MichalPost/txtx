import { create } from "zustand";

import {
  apiCancelTask,
  apiConfirmTaskDownload,
  apiCreateBatchDownloadTask,
  apiCreateScanTask,
  apiCreateSingleDownloadTask,
  apiDeleteTask,
  apiListTasks,
  apiLoadPersistedTasks,
  apiPauseTask,
} from "@/lib/api";
import { listenDesktopEvent } from "@/platform";
import type {
  BookCandidate,
  LogEntry,
  ScanTaskOptions,
  TaskEvent,
  TaskId,
  TaskRecord,
} from "@/types";

import { applyTaskEvent, makeLogEntry } from "./taskEventHandler";
import { hasTaskChanged } from "./taskSync";

const MAX_LOGS = 500;

interface PerTaskLogs {
  [taskId: string]: LogEntry[];
}

// Module-level promise cache to prevent concurrent init() calls (race condition fix)
let _initPromise: Promise<void> | null = null;
// Module-level interval id so it can be cleared on re-init (HMR / test safety)
let _pollIntervalId: ReturnType<typeof setInterval> | null = null;
// Module-level Tauri event unlisten function so it can be cleaned up on re-init
let _tauriUnlisten: (() => void) | null = null;

interface TaskStore {
  tasks: TaskRecord[];
  activeTaskId: TaskId | null;
  logs: PerTaskLogs;
  _initialized: boolean;

  // Lifecycle
  init: () => Promise<void>;

  // Queries
  getTask: (id: TaskId) => TaskRecord | undefined;
  getActiveLogs: () => LogEntry[];

  // Actions
  setActive: (id: TaskId | null) => void;
  createScanTask: (options?: ScanTaskOptions) => Promise<TaskId>;
  createBatchTask: (options?: ScanTaskOptions) => Promise<TaskId>;
  createSingleTask: (url: string) => Promise<TaskId>;
  confirmDownload: (taskId: TaskId, selected: BookCandidate[]) => Promise<void>;
  cancelTask: (id: TaskId) => Promise<void>;
  pauseTask: (id: TaskId) => Promise<void>;
  deleteTask: (id: TaskId) => Promise<void>;
  retryTask: (id: TaskId) => Promise<TaskId | null>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  logs: {},
  _initialized: false,

  init: async () => {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      if (get()._initialized) return;
      set({ _initialized: true });

      // Load persisted + in-memory tasks
      const [persisted, current] = await Promise.all([
        apiLoadPersistedTasks().catch(() => [] as TaskRecord[]),
        apiListTasks().catch(() => [] as TaskRecord[]),
      ]);
      const merged = [...current];
      for (const p of persisted) {
        if (!merged.find((t) => t.id === p.id)) merged.push(p);
      }
      set({ tasks: merged });

      // Subscribe to task_event (Tauri)
      try {
        // Clean up any existing Tauri listener before registering a new one (HMR safety)
        _tauriUnlisten?.();
        _tauriUnlisten = null;
        const unlisten = await listenDesktopEvent<TaskEvent>("task_event", (e) => {
          const event = e.payload;
          set((s) => {
            // Check if task exists; if not (race condition), skip
            const exists = s.tasks.find((t) => t.id === event.task_id);
            if (!exists) return s;

            const tasks = s.tasks.map((t) =>
              t.id === event.task_id ? applyTaskEvent(t, event) : t,
            );

            let newLogs = s.logs;
            if (event.type === "log" && event.message) {
              const entry = makeLogEntry(
                (event.level ?? "info") as LogEntry["level"],
                event.message,
              );
              const prev = s.logs[event.task_id] ?? [];
              newLogs = {
                ...s.logs,
                [event.task_id]: [...prev.slice(-(MAX_LOGS - 1)), entry],
              };
            }

            return { tasks, logs: newLogs };
          });
        });
        _tauriUnlisten = unlisten;
      } catch {
        // Non-Tauri environment: poll /api/tasks every 2s
        const pollTasks = async () => {
          try {
            const freshTasks = await apiListTasks();
            set((s) => {
              const updated = s.tasks.map((existing) => {
                const server = freshTasks.find((f) => f.id === existing.id);
                if (!server) return existing;
                if (hasTaskChanged(existing, server)) {
                  return server;
                }
                return existing;
              });
              // Also add any server-side tasks not yet in local store
              const newTasks = freshTasks.filter((f) => !s.tasks.find((e) => e.id === f.id));
              if (updated.some((u, i) => u !== s.tasks[i]) || newTasks.length > 0) {
                return { tasks: [...updated, ...newTasks] };
              }
              return s;
            });
          } catch {
            // Ignore poll errors
          }
        };

        // Start polling every 2 seconds
        if (_pollIntervalId !== null) clearInterval(_pollIntervalId);
        _pollIntervalId = setInterval(() => {
          void pollTasks();
        }, 2000);
      }
    })().catch((err) => {
      // Reset promise on failure so init() can be retried
      _initPromise = null;
      set({ _initialized: false });
      throw err;
    });
    return _initPromise;
  },

  getTask: (id) => get().tasks.find((t) => t.id === id),

  getActiveLogs: () => {
    const { activeTaskId, logs } = get();
    if (!activeTaskId) return [];
    return logs[activeTaskId] ?? [];
  },

  setActive: (id) => set({ activeTaskId: id }),

  createScanTask: async (options) => {
    const id = await apiCreateScanTask(options);
    const now = new Date().toLocaleString("sv").replace("T", " ");
    const newTask: TaskRecord = {
      id,
      kind: "full_scan",
      status: "scanning",
      label: `扫描 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      source_url: null,
      created_at: now,
      finished_at: null,
      total: 0,
      completed: 0,
      success_count: 0,
      error_count: 0,
      scan_items: [],
      scan_stats: null,
      stats: null,
      error_message: null,
    };
    set((s) => ({ tasks: [newTask, ...s.tasks], activeTaskId: id }));
    return id;
  },

  createBatchTask: async (options) => {
    const id = await apiCreateBatchDownloadTask(options);
    const now = new Date().toLocaleString("sv").replace("T", " ");
    const newTask: TaskRecord = {
      id,
      kind: "batch_download",
      status: "scanning",
      label: `批量下载 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      source_url: null,
      created_at: now,
      finished_at: null,
      total: 0,
      completed: 0,
      success_count: 0,
      error_count: 0,
      scan_items: [],
      scan_stats: null,
      stats: null,
      error_message: null,
    };
    set((s) => ({ tasks: [newTask, ...s.tasks], activeTaskId: id }));
    return id;
  },

  createSingleTask: async (url) => {
    const id = await apiCreateSingleDownloadTask(url);
    const label = url.trim().replace(/\/$/, "").split("/").pop() ?? url;
    const now = new Date().toLocaleString("sv").replace("T", " ");
    const newTask: TaskRecord = {
      id,
      kind: "single_download",
      status: "downloading",
      label: `单本: ${label}`,
      source_url: url,
      created_at: now,
      finished_at: null,
      total: 1,
      completed: 0,
      success_count: 0,
      error_count: 0,
      scan_items: [],
      scan_stats: null,
      stats: null,
      error_message: null,
    };
    set((s) => ({ tasks: [newTask, ...s.tasks], activeTaskId: id }));
    return id;
  },

  confirmDownload: async (taskId, selected) => {
    await apiConfirmTaskDownload(taskId, selected);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: "downloading" as const, total: selected.length } : t,
      ),
    }));
  },

  cancelTask: async (id) => {
    await apiCancelTask(id);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "cancelled" as const } : t)),
    }));
  },

  pauseTask: async (id) => {
    await apiPauseTask(id);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "paused" as const } : t)),
    }));
  },

  deleteTask: async (id) => {
    await apiDeleteTask(id);
    set((s) => {
      const remaining = s.tasks.filter((t) => t.id !== id);
      const nextActive = s.activeTaskId === id ? (remaining[0]?.id ?? null) : s.activeTaskId;
      // Also clean up logs to prevent unbounded memory growth
      const remainingLogs = { ...s.logs };
      delete remainingLogs[id];
      return { tasks: remaining, activeTaskId: nextActive, logs: remainingLogs };
    });
  },

  retryTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return null;
    if (task.kind === "single_download") {
      const url = task.source_url ?? task.scan_items[0]?.url ?? "";
      if (!url) return null;
      return get().createSingleTask(url);
    }
    if (task.kind === "batch_download") return get().createBatchTask();
    if (task.kind === "full_scan") return get().createScanTask();
    return null;
  },
}));

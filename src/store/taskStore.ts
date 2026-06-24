import { create } from "zustand";

import {
  apiCancelTask,
  apiConfirmTaskDownload,
  apiCreateBatchDownloadTask,
  apiCreateScanTask,
  apiCreateSelectedDownloadTask,
  apiCreateSingleDownloadTask,
  apiDeleteTask,
  apiListTasks,
  apiLoadPersistedTasks,
  apiPauseTask,
  apiUpdateTaskPreviewDraft,
} from "@/lib/api";
import { listenDesktopEvent } from "@/platform";
import type {
  BookCandidate,
  LogEntry,
  ScanTaskOptions,
  ScanItem,
  TaskEvent,
  TaskId,
  TaskPreviewDraft,
  TaskRecord,
} from "@/types";

import { applyTaskEvent, makeLogEntry } from "./taskEventHandler";
import {
  applyTaskPollFailure,
  applyTaskPollSuccess,
  getTaskPollScheduleDelayMs,
} from "./taskPollingState";
import { buildDefaultPreviewDraft, hasRunningTask, mergeTaskSnapshots } from "./taskStoreUtils";

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
const _previewDraftSyncTimers = new Map<TaskId, ReturnType<typeof setTimeout>>();

interface TaskStore {
  tasks: TaskRecord[];
  activeTaskId: TaskId | null;
  logs: PerTaskLogs;
  previewDrafts: Record<TaskId, TaskPreviewDraft>;
  _initialized: boolean;
  _needsRefresh: boolean;
  pollError: string | null;
  pollErrorVersion: number;
  pollFailureCount: number;
  nextPollDelayMs: number;
  lastRecoveredAt: string | null;

  // Lifecycle
  init: () => Promise<void>;
  refreshTasks: () => Promise<void>;

  // Queries
  getTask: (id: TaskId) => TaskRecord | undefined;
  getActiveLogs: () => LogEntry[];
  getPreviewDraft: (taskId: TaskId, items: ScanItem[]) => TaskPreviewDraft;

  // Actions
  setActive: (id: TaskId | null) => void;
  updatePreviewDraft: (taskId: TaskId, draft: Partial<TaskPreviewDraft>) => void;
  clearPreviewDraft: (taskId: TaskId) => void;
  createScanTask: (options?: ScanTaskOptions) => Promise<TaskId>;
  createBatchTask: (options?: ScanTaskOptions) => Promise<TaskId>;
  createSingleTask: (url: string) => Promise<TaskId>;
  createSelectedTask: (selected: BookCandidate[]) => Promise<TaskId>;
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
  previewDrafts: {},
  _initialized: false,
  _needsRefresh: false,
  pollError: null,
  pollErrorVersion: 0,
  pollFailureCount: 0,
  nextPollDelayMs: 2000,
  lastRecoveredAt: null,

  refreshTasks: async () => {
    try {
      const freshTasks = await apiListTasks();
      set((s) => {
        const merged = mergeTaskSnapshots(s.tasks, freshTasks, s.activeTaskId);
        const pollState = applyTaskPollSuccess(s);

        const tasksChanged =
          merged.activeTaskId !== s.activeTaskId ||
          merged.tasks.length !== s.tasks.length ||
          merged.tasks.some((task, index) => task !== s.tasks[index]);

        if (!tasksChanged && pollState === s) {
          return s;
        }

        return {
          ...(pollState === s ? s : { ...s, ...pollState }),
          _needsRefresh: false,
          previewDrafts: Object.fromEntries(
            merged.tasks
              .filter((task) => task.preview_draft)
              .map((task) => [task.id, task.preview_draft as TaskPreviewDraft]),
          ),
          tasks: tasksChanged ? merged.tasks : s.tasks,
          activeTaskId: tasksChanged ? merged.activeTaskId : s.activeTaskId,
        };
      });
    } catch (error) {
      set((s) => ({ ...s, ...applyTaskPollFailure(s, error) }));
      throw error;
    }
  },

  init: async () => {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      if (get()._initialized) return;
      set({ _initialized: true });

      // Load persisted + in-memory tasks
      const persisted = await apiLoadPersistedTasks().catch(() => [] as TaskRecord[]);
      let current: TaskRecord[] = [];
      try {
        current = await apiListTasks();
      } catch (error) {
        set((s) => applyTaskPollFailure(s, error));
      }
      const merged = [...current];
      for (const p of persisted) {
        if (!merged.find((t) => t.id === p.id)) merged.push(p);
      }
      set({
        tasks: merged,
        previewDrafts: Object.fromEntries(
          merged
            .filter((task) => task.preview_draft)
            .map((task) => [task.id, task.preview_draft as TaskPreviewDraft]),
        ),
      });

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
            if (!exists) {
              return { ...s, _needsRefresh: true };
            }

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

        if (_pollIntervalId !== null) clearInterval(_pollIntervalId);
        _pollIntervalId = setInterval(() => {
          const state = get();
          if (!state._needsRefresh) return;
          void state.refreshTasks().catch((error) => {
            void error;
            set({ _needsRefresh: true });
          });
        }, 5000);
      } catch {
        // Non-Tauri environment: poll /api/tasks every 2s
        const pollTasks = async () => {
          try {
            await get().refreshTasks();
          } catch {
            // refreshTasks records the failure state; polling only reschedules.
          }
        };

        const schedulePoll = () => {
          const state = get();
          const delayMs = getTaskPollScheduleDelayMs({
            baseDelayMs: state.nextPollDelayMs,
            hasRunningTask: hasRunningTask(state.tasks),
            isDocumentVisible:
              typeof document === "undefined" || document.visibilityState === "visible",
            isTaskRoute:
              typeof window !== "undefined" && window.location.hash.startsWith("#/tasks"),
          });
          _pollIntervalId = setTimeout(() => {
            void pollTasks().finally(() => {
              schedulePoll();
            });
          }, delayMs);
        };

        if (_pollIntervalId !== null) clearTimeout(_pollIntervalId);
        schedulePoll();
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

  getPreviewDraft: (taskId, items) => {
    return buildDefaultPreviewDraft(items, get().previewDrafts[taskId]);
  },

  setActive: (id) => set({ activeTaskId: id }),

  updatePreviewDraft: (taskId, draft) =>
    set((s) => {
      const nextDraft = {
        ...(s.previewDrafts[taskId] ?? {
          deselected_urls: [],
          site_filter: "",
          scan_sort: "date" as const,
          visible_count: 100,
        }),
        ...draft,
      };

      if (_previewDraftSyncTimers.has(taskId)) {
        clearTimeout(_previewDraftSyncTimers.get(taskId)!);
      }
      _previewDraftSyncTimers.set(
        taskId,
        setTimeout(() => {
          void apiUpdateTaskPreviewDraft(taskId, nextDraft).catch(() => undefined);
          _previewDraftSyncTimers.delete(taskId);
        }, 400),
      );

      return {
        previewDrafts: {
          ...s.previewDrafts,
          [taskId]: nextDraft,
        },
        tasks: s.tasks.map((task) =>
          task.id === taskId ? { ...task, preview_draft: nextDraft } : task,
        ),
      };
    }),

  clearPreviewDraft: (taskId) =>
    set((s) => {
      const previewDrafts = { ...s.previewDrafts };
      delete previewDrafts[taskId];
      if (_previewDraftSyncTimers.has(taskId)) {
        clearTimeout(_previewDraftSyncTimers.get(taskId)!);
        _previewDraftSyncTimers.delete(taskId);
      }
      return { previewDrafts };
    }),

  createScanTask: async (options) => {
    const id = await apiCreateScanTask(options);
    const now = new Date().toLocaleString("sv").replace("T", " ");
    const newTask: TaskRecord = {
      id,
      kind: "full_scan",
      status: "scanning",
      label: `扫描 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      source_url: null,
      retry_context: {
        scan_options: options ?? null,
        selected_items: null,
      },
      preview_draft: null,
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
      retry_context: {
        scan_options: options ?? null,
        selected_items: null,
      },
      preview_draft: null,
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
      retry_context: null,
      preview_draft: null,
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

  createSelectedTask: async (selected) => {
    const id = await apiCreateSelectedDownloadTask(selected);
    const now = new Date().toLocaleString("sv").replace("T", " ");
    const newTask: TaskRecord = {
      id,
      kind: "selected_download",
      status: "downloading",
      label: `精选下载 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      source_url: null,
      retry_context: {
        scan_options: null,
        selected_items: selected,
      },
      preview_draft: null,
      created_at: now,
      finished_at: null,
      total: selected.length,
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
      previewDrafts: Object.fromEntries(
        Object.entries(s.previewDrafts).filter(([id]) => id !== taskId),
      ),
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "downloading" as const,
              total: selected.length,
              kind: "selected_download" as const,
              retry_context: {
                scan_options: t.retry_context?.scan_options ?? null,
                selected_items: selected,
              },
              preview_draft: null,
            }
          : t,
        ),
    }));
    await get().refreshTasks().catch(() => undefined);
  },

  cancelTask: async (id) => {
    await apiCancelTask(id);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "cancelled" as const } : t)),
    }));
    await get().refreshTasks().catch(() => undefined);
  },

  pauseTask: async (id) => {
    await apiPauseTask(id);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "paused" as const } : t)),
    }));
    await get().refreshTasks().catch(() => undefined);
  },

  deleteTask: async (id) => {
    await apiDeleteTask(id);
    set((s) => {
      const remaining = s.tasks.filter((t) => t.id !== id);
      const nextActive = s.activeTaskId === id ? (remaining[0]?.id ?? null) : s.activeTaskId;
      // Also clean up logs to prevent unbounded memory growth
      const remainingLogs = { ...s.logs };
      const remainingDrafts = { ...s.previewDrafts };
      delete remainingLogs[id];
      delete remainingDrafts[id];
      return {
        tasks: remaining,
        activeTaskId: nextActive,
        logs: remainingLogs,
        previewDrafts: remainingDrafts,
      };
    });
    await get().refreshTasks().catch(() => undefined);
  },

  retryTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return null;
    if (task.kind === "single_download") {
      const url = task.source_url ?? task.scan_items[0]?.url ?? "";
      if (!url) return null;
      return get().createSingleTask(url);
    }
    if (task.kind === "selected_download") {
      const selected = task.retry_context?.selected_items ?? [];
      if (selected.length === 0) return null;
      return get().createSelectedTask(selected);
    }
    if (task.kind === "batch_download") {
      return get().createBatchTask(task.retry_context?.scan_options ?? undefined);
    }
    if (task.kind === "full_scan") {
      return get().createScanTask(task.retry_context?.scan_options ?? undefined);
    }
    return null;
  },
}));

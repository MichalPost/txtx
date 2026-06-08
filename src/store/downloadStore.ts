import { create } from "zustand";

import {
  apiClearQueue,
  apiGetQueue,
  apiStartDownload,
  apiStartScan,
  apiStartSelectedDownload,
  apiStartSingleDownload,
  apiStopDownload,
  type UnsubscribeFn,
} from "@/lib/api";
import type {
  BookCandidate,
  DownloadStats,
  DownloadStatus,
  LogEntry,
  QueueStatus,
  ScanItem,
  ScanOptions,
  SiteProgress,
} from "@/types";

import { handleEvent, makeAddLog } from "./downloadEventHandler";
import { initialSpeed, type SpeedState } from "./speedTracker";

export interface NovelProgress {
  name: string;
  current: number;
  total: number;
}

/** Three-step workflow phase */
export type DownloadPhase = "idle" | "scanning" | "preview" | "downloading" | "done" | "stopped";

export interface NovelResult {
  name: string;
  url: string;
  site: string;
  date: string;
  status: "success" | "error";
  message?: string;
}

interface DownloadState {
  // ── Phase tracking ──────────────────────────────────────────────────────────
  phase: DownloadPhase;
  status: DownloadStatus;

  // ── Scan options (set before scan) ─────────────────────────────────────────
  scanOptions: ScanOptions;

  // ── Scan results (phase 2) ──────────────────────────────────────────────────
  scanItems: ScanItem[];
  selectedUrls: Set<string>;
  scanStats: DownloadStats | null;

  // ── Download progress (phase 3) ─────────────────────────────────────────────
  siteProgress: Record<string, SiteProgress>;
  novelProgress: Record<string, NovelProgress>;
  novelResults: NovelResult[];
  stats: DownloadStats | null;
  overallTotal: number;
  overallCompleted: number;

  // ── Speed tracking ──────────────────────────────────────────────────────────
  speed: SpeedState;

  // ── Queue status ────────────────────────────────────────────────────────────
  queueStatus: QueueStatus | null;

  // ── Logs ────────────────────────────────────────────────────────────────────
  logs: LogEntry[];

  _unsub: UnsubscribeFn | null;

  // ── Actions ─────────────────────────────────────────────────────────────────
  startScan: () => void;
  startSelectedDownload: () => void;
  toggleSelect: (url: string) => void;
  selectAll: (value: boolean) => void;
  startDownload: () => void;
  startSingleDownload: (url: string) => void;
  stopDownload: () => Promise<void>;
  /** Pause = stop but keep queue intact (resume via QueueResumePanel) */
  pauseDownload: () => Promise<void>;
  clearLogs: () => void;
  addLog: (level: LogEntry["level"], message: string) => void;
  reset: () => void;
  /** Retry all failed novels */
  retryFailed: () => void;
  /** Load queue status from backend */
  loadQueueStatus: () => Promise<void>;
  /** Clear the persisted queue file */
  clearQueueFile: () => Promise<void>;
  /** Update scan options */
  setScanOptions: (opts: Partial<ScanOptions>) => void;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  phase: "idle",
  status: "idle",
  scanItems: [],
  selectedUrls: new Set(),
  scanStats: null,
  siteProgress: {},
  novelProgress: {},
  novelResults: [],
  stats: null,
  logs: [],
  overallTotal: 0,
  overallCompleted: 0,
  speed: initialSpeed,
  queueStatus: null,
  scanOptions: {},
  _unsub: null,

  addLog: makeAddLog(set),

  clearLogs: () => set({ logs: [] }),

  reset: () => {
    // Cancel any active WebSocket/Tauri subscription before resetting state
    get()._unsub?.();
    set({
      phase: "idle",
      status: "idle",
      scanItems: [],
      selectedUrls: new Set(),
      scanStats: null,
      siteProgress: {},
      novelProgress: {},
      novelResults: [],
      stats: null,
      overallTotal: 0,
      overallCompleted: 0,
      speed: initialSpeed,
      _unsub: null,
    });
  },

  toggleSelect: (url) => {
    set((s) => {
      const next = new Set(s.selectedUrls);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return { selectedUrls: next };
    });
  },

  selectAll: (value) => {
    set((s) => {
      if (!value) return { selectedUrls: new Set() };
      const all = new Set(s.scanItems.filter((i) => !i.excluded_reason).map((i) => i.url));
      return { selectedUrls: all };
    });
  },

  // ── Phase 1: scan ──────────────────────────────────────────────────────────
  startScan: () => {
    get()._unsub?.();
    set({
      phase: "scanning",
      status: "scanning",
      scanItems: [],
      selectedUrls: new Set(),
      scanStats: null,
      siteProgress: {},
      novelProgress: {},
      stats: null,
      overallTotal: 0,
      overallCompleted: 0,
      speed: initialSpeed,
    });
    get().addLog("info", "开始扫描站点...");
    const opts = get().scanOptions;
    const unsub = apiStartScan(
      handleEvent(get as never, set as never),
      Object.keys(opts).length > 0 ? opts : undefined,
    );
    set({ _unsub: unsub });
  },

  // ── Phase 3: download selected ─────────────────────────────────────────────
  startSelectedDownload: () => {
    const { scanItems, selectedUrls } = get();
    const selected: BookCandidate[] = scanItems
      .filter((i) => selectedUrls.has(i.url))
      .map((i) => ({ name: i.name, url: i.url, crawler_domain: i.site, date: i.date }));

    if (selected.length === 0) {
      get().addLog("warn", "未选中任何书籍");
      return;
    }

    get()._unsub?.();
    set({
      phase: "downloading",
      status: "downloading",
      siteProgress: {},
      novelProgress: {},
      novelResults: [],
      stats: null,
      overallTotal: selected.length,
      overallCompleted: 0,
      speed: initialSpeed,
    });
    get().addLog("info", `开始下载选中的 ${selected.length} 本书...`);
    const unsub = apiStartSelectedDownload(selected, handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  // ── Retry failed ──────────────────────────────────────────────────────────
  retryFailed: () => {
    const { novelResults, scanItems } = get();
    // Use URL as the unique key to avoid name collisions across different sites
    const failedUrls = new Set(
      novelResults
        .filter((r) => r.status === "error")
        .map((r) => r.url)
        .filter(Boolean),
    );
    if (failedUrls.size === 0) return;

    const selected: BookCandidate[] = scanItems
      .filter((i) => failedUrls.has(i.url))
      .map((i) => ({ name: i.name, url: i.url, crawler_domain: i.site, date: i.date }));

    if (selected.length === 0) {
      get().addLog("warn", "找不到失败项的原始数据，无法重试");
      return;
    }

    get()._unsub?.();
    const keptResults = novelResults.filter((r) => r.status !== "error");
    set({
      phase: "downloading",
      status: "downloading",
      novelProgress: {},
      novelResults: keptResults,
      overallTotal: keptResults.length + selected.length,
      overallCompleted: keptResults.length,
      speed: initialSpeed,
    });
    get().addLog("info", `重试 ${selected.length} 本失败的书籍...`);
    const unsub = apiStartSelectedDownload(selected, handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  // ── Legacy: one-shot batch ─────────────────────────────────────────────────
  startDownload: () => {
    get()._unsub?.();
    set({
      phase: "downloading",
      status: "scanning",
      siteProgress: {},
      novelProgress: {},
      stats: null,
      overallTotal: 0,
      overallCompleted: 0,
      speed: initialSpeed,
    });
    get().addLog("info", "开始下载任务...");
    const unsub = apiStartDownload(handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  startSingleDownload: (url: string) => {
    get()._unsub?.();
    set({
      phase: "downloading",
      status: "scanning",
      siteProgress: {},
      novelProgress: {},
      stats: null,
      overallTotal: 0,
      overallCompleted: 0,
      speed: initialSpeed,
    });
    get().addLog("info", `单本下载: ${url}`);
    const unsub = apiStartSingleDownload(url, handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  stopDownload: async () => {
    try {
      get()._unsub?.();
      set({ _unsub: null });
      await apiStopDownload().catch(() => {});
      set({ phase: "stopped", status: "stopped" });
      get().addLog("warn", "已停止");
    } catch (e) {
      get().addLog("error", `停止失败: ${String(e)}`);
    }
  },

  pauseDownload: async () => {
    try {
      get()._unsub?.();
      set({ _unsub: null });
      await apiStopDownload().catch(() => {});
      set({ phase: "stopped", status: "stopped" });
      get().addLog("warn", "已暂停，下载队列已保存，可稍后恢复");
      await get().loadQueueStatus();
    } catch (e) {
      get().addLog("error", `暂停失败: ${String(e)}`);
    }
  },

  setScanOptions: (opts) => {
    set((s) => ({ scanOptions: { ...s.scanOptions, ...opts } }));
  },

  // ── Queue management ───────────────────────────────────────────────────────
  loadQueueStatus: async () => {
    try {
      const status = await apiGetQueue();
      set({ queueStatus: status });
    } catch {
      set({ queueStatus: { exists: false } });
    }
  },

  clearQueueFile: async () => {
    try {
      await apiClearQueue();
      set({ queueStatus: { exists: false } });
    } catch (e) {
      get().addLog("error", `清除队列失败: ${String(e)}`);
    }
  },
}));

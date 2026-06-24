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
import {
  getDownloadRunState,
  pauseDownloadAndUpdateState,
  stopDownloadAndUpdateState,
} from "./downloadControlLogic";
import { applyScanSelectionBatch } from "@/components/download/scan-preview/scanPreviewUtils";
import { initialSpeed, type SpeedState } from "./speedTracker";

export interface NovelProgress {
  name: string;
  current: number;
  total: number;
}

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
  // Phase tracking
  phase: DownloadPhase;
  status: DownloadStatus;

  // Scan options
  scanOptions: ScanOptions;

  // Scan results
  scanItems: ScanItem[];
  selectedUrls: Set<string>;
  scanStats: DownloadStats | null;

  // Download progress
  siteProgress: Record<string, SiteProgress>;
  novelProgress: Record<string, NovelProgress>;
  novelResults: NovelResult[];
  stats: DownloadStats | null;
  overallTotal: number;
  overallCompleted: number;

  // Speed tracking
  speed: SpeedState;

  // Queue status
  queueStatus: QueueStatus | null;

  // Logs
  logs: LogEntry[];

  _unsub: UnsubscribeFn | null;

  // Actions
  startScan: () => void;
  startSelectedDownload: () => void;
  toggleSelect: (url: string) => void;
  selectUrls: (urls: Iterable<string>, value: boolean) => void;
  selectAll: (value: boolean) => void;
  startDownload: () => void;
  startSingleDownload: (url: string) => void;
  stopDownload: () => Promise<void>;
  pauseDownload: () => Promise<void>;
  clearLogs: () => void;
  addLog: (level: LogEntry["level"], message: string) => void;
  reset: () => void;
  retryFailed: () => void;
  loadQueueStatus: () => Promise<void>;
  clearQueueFile: () => Promise<void>;
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
    set((state) => {
      const next = new Set(state.selectedUrls);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return { selectedUrls: next };
    });
  },

  selectUrls: (urls, value) => {
    set((state) => ({
      selectedUrls: applyScanSelectionBatch(state.selectedUrls, {
        urls,
        selected: value,
      }),
    }));
  },

  selectAll: (value) => {
    set((state) => {
      if (!value) return { selectedUrls: new Set() };
      const all = new Set(state.scanItems.filter((item) => !item.excluded_reason).map((item) => item.url));
      return { selectedUrls: all };
    });
  },

  // Phase 1: scan
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

  // Phase 3: download selected
  startSelectedDownload: () => {
    const { scanItems, selectedUrls } = get();
    const selected: BookCandidate[] = scanItems
      .filter((item) => selectedUrls.has(item.url))
      .map((item) => ({
        name: item.name,
        url: item.url,
        crawler_domain: item.site,
        date: item.date,
      }));

    if (selected.length === 0) {
      get().addLog("warn", "请先勾选至少一本书再开始下载");
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
    get().addLog("info", `开始下载已选择的 ${selected.length} 本书...`);
    const unsub = apiStartSelectedDownload(selected, handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  // Retry failed
  retryFailed: () => {
    const { novelResults, scanItems } = get();
    const failedUrls = new Set(
      novelResults
        .filter((result) => result.status === "error")
        .map((result) => result.url)
        .filter(Boolean),
    );
    if (failedUrls.size === 0) return;

    const selected: BookCandidate[] = scanItems
      .filter((item) => failedUrls.has(item.url))
      .map((item) => ({
        name: item.name,
        url: item.url,
        crawler_domain: item.site,
        date: item.date,
      }));

    if (selected.length === 0) {
      get().addLog("warn", "找不到失败条目的原始扫描数据，暂时无法重试");
      return;
    }

    get()._unsub?.();
    const keptResults = novelResults.filter((result) => result.status !== "error");
    set({
      phase: "downloading",
      status: "downloading",
      novelProgress: {},
      novelResults: keptResults,
      overallTotal: keptResults.length + selected.length,
      overallCompleted: keptResults.length,
      speed: initialSpeed,
    });
    get().addLog("info", `重新尝试下载 ${selected.length} 本失败书籍...`);
    const unsub = apiStartSelectedDownload(selected, handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  // One-shot batch download
  startDownload: () => {
    get()._unsub?.();
    const runState = getDownloadRunState();
    set({
      ...runState,
      siteProgress: {},
      novelProgress: {},
      stats: null,
      overallTotal: 0,
      overallCompleted: 0,
      speed: initialSpeed,
    });
    get().addLog("info", "开始批量下载...");
    const unsub = apiStartDownload(handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  startSingleDownload: (url: string) => {
    get()._unsub?.();
    const runState = getDownloadRunState();
    set({
      ...runState,
      siteProgress: {},
      novelProgress: {},
      stats: null,
      overallTotal: 0,
      overallCompleted: 0,
      speed: initialSpeed,
    });
    get().addLog("info", `开始下载单本：${url}`);
    const unsub = apiStartSingleDownload(url, handleEvent(get as never, set as never));
    set({ _unsub: unsub });
  },

  stopDownload: async () => {
    try {
      get()._unsub?.();
      set({ _unsub: null });
      await stopDownloadAndUpdateState(apiStopDownload, async () => {
        set({ phase: "stopped", status: "stopped" });
        get().addLog("warn", "下载已停止");
      });
    } catch (error) {
      get().addLog("error", `停止下载失败：${String(error)}`);
    }
  },

  pauseDownload: async () => {
    try {
      get()._unsub?.();
      set({ _unsub: null });
      await pauseDownloadAndUpdateState(apiStopDownload, async () => {
        set({ phase: "stopped", status: "stopped" });
        get().addLog("warn", "下载已暂停，当前队列已保留，可稍后恢复");
        await get().loadQueueStatus();
      });
    } catch (error) {
      get().addLog("error", `暂停下载失败：${String(error)}`);
    }
  },

  setScanOptions: (opts) => {
    set((state) => ({ scanOptions: { ...state.scanOptions, ...opts } }));
  },

  // Queue management
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
    } catch (error) {
      get().addLog("error", `清除断点队列失败：${String(error)}`);
    }
  },
}));

import { create } from "zustand";
import dayjs from "dayjs";
import {
  apiStartScan, apiStartSelectedDownload,
  apiStartDownload, apiStartSingleDownload, apiStopDownload,
  apiGetQueue, apiClearQueue,
  type UnsubscribeFn,
} from "@/lib/api";
import type {
  DownloadStatus, ScanItem, BookCandidate,
  SiteProgress, DownloadStats, LogEntry, ProgressEvent,
  QueueStatus, ScanOptions,
} from "@/types";

let logIdCounter = 0;

export interface NovelProgress {
  name: string;
  current: number;
  total: number;
}

/** Three-step workflow phase */
export type DownloadPhase =
  | "idle"
  | "scanning"
  | "preview"
  | "downloading"
  | "done"
  | "stopped";

export interface NovelResult {
  name: string;
  url: string;
  site: string;
  date: string;
  status: "success" | "error";
  message?: string;
}

// ─── Speed tracking ───────────────────────────────────────────────────────────

const SPEED_WINDOW_MS = 10_000; // 10 second sliding window

interface SpeedState {
  /** Timestamps (ms) of recent chapter_done events */
  chapterTimestamps: number[];
  /** Chapters/second (smoothed) */
  chaptersPerSecond: number;
  /** Estimated seconds remaining (-1 = unknown) */
  etaSeconds: number;
}

function computeSpeed(timestamps: number[], remainingChapters: number): SpeedState {
  const now = Date.now();
  const recent = timestamps.filter((t) => now - t < SPEED_WINDOW_MS);
  const cps = recent.length / (SPEED_WINDOW_MS / 1000);
  const eta = cps > 0 ? Math.round(remainingChapters / cps) : -1;
  return { chapterTimestamps: recent, chaptersPerSecond: cps, etaSeconds: eta };
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

const initialSpeed: SpeedState = {
  chapterTimestamps: [],
  chaptersPerSecond: 0,
  etaSeconds: -1,
};

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

  addLog: (level, message) => {
    const entry: LogEntry = {
      id: ++logIdCounter,
      timestamp: dayjs().format("HH:mm:ss"),
      level,
      message,
    };
    set((s) => ({ logs: [...s.logs.slice(-500), entry] }));
  },

  clearLogs: () => set({ logs: [] }),

  reset: () => set({
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
  }),

  toggleSelect: (url) => {
    set((s) => {
      const next = new Set(s.selectedUrls);
      if (next.has(url)) next.delete(url); else next.add(url);
      return { selectedUrls: next };
    });
  },

  selectAll: (value) => {
    set((s) => {
      if (!value) return { selectedUrls: new Set() };
      const all = new Set(
        s.scanItems
          .filter((i) => !i.excluded_reason)
          .map((i) => i.url)
      );
      return { selectedUrls: all };
    });
  },

  // ── Phase 1: scan ──────────────────────────────────────────────────────────
  startScan: () => {
    get()._unsub?.();
    set({
      phase: "scanning", status: "scanning",
      scanItems: [], selectedUrls: new Set(), scanStats: null,
      siteProgress: {}, novelProgress: {}, stats: null,
      overallTotal: 0, overallCompleted: 0, speed: initialSpeed,
    });
    get().addLog("info", "开始扫描站点...");
    const opts = get().scanOptions;
    const unsub = apiStartScan(handleEvent(get, set), Object.keys(opts).length > 0 ? opts : undefined);
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
      phase: "downloading", status: "downloading",
      siteProgress: {}, novelProgress: {}, novelResults: [], stats: null,
      overallTotal: selected.length, overallCompleted: 0, speed: initialSpeed,
    });
    get().addLog("info", `开始下载选中的 ${selected.length} 本书...`);
    const unsub = apiStartSelectedDownload(selected, handleEvent(get, set));
    set({ _unsub: unsub });
  },

  // ── Retry failed ──────────────────────────────────────────────────────────
  retryFailed: () => {
    const { novelResults, scanItems } = get();
    const failedNames = new Set(
      novelResults.filter((r) => r.status === "error").map((r) => r.name)
    );
    if (failedNames.size === 0) return;

    // Build candidates from scanItems matching failed names
    const selected: BookCandidate[] = scanItems
      .filter((i) => failedNames.has(i.name))
      .map((i) => ({ name: i.name, url: i.url, crawler_domain: i.site, date: i.date }));

    if (selected.length === 0) {
      get().addLog("warn", "找不到失败项的原始数据，无法重试");
      return;
    }

    get()._unsub?.();
    // Keep existing results but remove failed ones (they'll be re-added)
    const keptResults = novelResults.filter((r) => r.status !== "error");
    set({
      phase: "downloading", status: "downloading",
      novelProgress: {},
      novelResults: keptResults,
      overallTotal: keptResults.length + selected.length,
      overallCompleted: keptResults.length,
      speed: initialSpeed,
    });
    get().addLog("info", `重试 ${selected.length} 本失败的书籍...`);
    const unsub = apiStartSelectedDownload(selected, handleEvent(get, set));
    set({ _unsub: unsub });
  },

  // ── Legacy: one-shot batch ─────────────────────────────────────────────────
  startDownload: () => {
    get()._unsub?.();
    set({
      phase: "downloading", status: "scanning",
      siteProgress: {}, novelProgress: {}, stats: null,
      overallTotal: 0, overallCompleted: 0, speed: initialSpeed,
    });
    get().addLog("info", "开始下载任务...");
    const unsub = apiStartDownload(handleEvent(get, set));
    set({ _unsub: unsub });
  },

  startSingleDownload: (url: string) => {
    get()._unsub?.();
    set({
      phase: "downloading", status: "scanning",
      siteProgress: {}, novelProgress: {}, stats: null,
      overallTotal: 0, overallCompleted: 0, speed: initialSpeed,
    });
    get().addLog("info", `单本下载: ${url}`);
    const unsub = apiStartSingleDownload(url, handleEvent(get, set));
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
      // Reload queue status so the resume panel appears
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

// ─── Event handler ────────────────────────────────────────────────────────────

function handleEvent(
  get: () => DownloadState,
  set: (partial: Partial<DownloadState> | ((s: DownloadState) => Partial<DownloadState>)) => void,
) {
  return (payload: ProgressEvent) => {
    const { addLog } = get();

    switch (payload.type) {
      case "log":
        addLog((payload.level as LogEntry["level"]) ?? "info", payload.message ?? "");
        break;

      case "scan_start":
        if (payload.site) {
          set((s) => ({
            siteProgress: {
              ...s.siteProgress,
              [payload.site!]: { domain: payload.site!, total: 0, completed: 0, status: "scanning" },
            },
          }));
        }
        break;

      case "scan_done":
        if (payload.site) {
          set((s) => ({
            siteProgress: {
              ...s.siteProgress,
              [payload.site!]: { ...s.siteProgress[payload.site!], total: payload.total ?? 0, status: "downloading" },
            },
          }));
        }
        break;

      case "scan_complete": {
        const items = payload.items ?? [];
        const stats = payload.stats ?? null;
        const selectedUrls = new Set(
          items.filter((i) => !i.excluded_reason).map((i) => i.url)
        );
        set({ phase: "preview", status: "idle", scanItems: items, selectedUrls, scanStats: stats });
        addLog("success", `扫描完成，共 ${items.filter((i) => !i.excluded_reason).length} 本待下载`);
        break;
      }

      case "filter_done":
        if (payload.stats) {
          set({ stats: payload.stats, overallTotal: payload.stats.final_download, status: "downloading" });
          addLog("info", `筛选完成：待下载 ${payload.stats.final_download} 本`);
        }
        break;

      case "chapter_done":
        if (payload.novel) {
          set((s) => {
            const now = Date.now();
            const newTimestamps = [...s.speed.chapterTimestamps, now];
            // Calculate remaining chapters across all active novels
            const activeNovels = Object.values(s.novelProgress);
            const remainingChapters = activeNovels.reduce(
              (acc, n) => acc + Math.max(0, n.total - n.current), 0
            );
            const newSpeed = computeSpeed(newTimestamps, remainingChapters);

            return {
              novelProgress: {
                ...s.novelProgress,
                [payload.novel!]: {
                  name: payload.novel!,
                  current: payload.current ?? 0,
                  total: payload.total ?? 0,
                },
              },
              speed: newSpeed,
            };
          });
        }
        break;

      case "novel_done":
        set((s) => {
          const completed = s.overallCompleted + 1;
          const site = payload.site;
          const updated = { ...s.siteProgress };
          if (site && updated[site]) {
            updated[site] = { ...updated[site], completed: updated[site].completed + 1 };
          }
          const np = { ...s.novelProgress };
          if (payload.novel) delete np[payload.novel];

          // Find original scan item for this novel to get url/site/date
          const scanItem = s.scanItems.find((i) => i.name === payload.novel);
          const results: NovelResult[] = payload.novel
            ? [...s.novelResults, {
                name: payload.novel,
                url: scanItem?.url ?? "",
                site: scanItem?.site ?? (payload.site ?? ""),
                date: scanItem?.date ?? "",
                status: "success",
              }]
            : s.novelResults;
          return { overallCompleted: completed, siteProgress: updated, novelProgress: np, novelResults: results };
        });
        if (payload.novel) addLog("success", `✓ ${payload.novel}`);
        break;

      case "novel_error":
        if (payload.novel) {
          set((s) => {
            const scanItem = s.scanItems.find((i) => i.name === payload.novel);
            return {
              novelResults: [...s.novelResults, {
                name: payload.novel!,
                url: scanItem?.url ?? "",
                site: scanItem?.site ?? (payload.site ?? ""),
                date: scanItem?.date ?? "",
                status: "error",
                message: payload.message,
              }],
            };
          });
          addLog("error", `✗ ${payload.novel}: ${payload.message ?? ""}`);
        }
        break;

      case "overall_done":
        set({ phase: "done", status: "done" });
        addLog("success", "所有任务完成！");
        break;
    }
  };
}

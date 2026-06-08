/**
 * 下载事件处理器
 * 将后端推送的 ProgressEvent 映射到 store 状态变更
 */
import dayjs from "dayjs";

import type { DownloadStats, LogEntry, ProgressEvent, SiteProgress } from "@/types";

import type { DownloadPhase, NovelProgress, NovelResult } from "./downloadStore";
import { computeSpeed, type SpeedState } from "./speedTracker";

let logIdCounter = 0;

export interface EventHandlerState {
  phase: DownloadPhase;
  scanItems: { name: string; url: string; site: string; date: string; excluded_reason?: string }[];
  siteProgress: Record<string, SiteProgress>;
  novelProgress: Record<string, NovelProgress>;
  novelResults: NovelResult[];
  overallCompleted: number;
  overallTotal: number;
  speed: SpeedState;
  stats: DownloadStats | null;
  logs: LogEntry[];
}

type SetFn = (
  partial: Partial<EventHandlerState> | ((s: EventHandlerState) => Partial<EventHandlerState>),
) => void;

type GetFn = () => EventHandlerState & {
  addLog: (level: LogEntry["level"], message: string) => void;
};

export function makeAddLog(
  set: (
    partial: { logs: LogEntry[] } | ((s: { logs: LogEntry[] }) => { logs: LogEntry[] }),
  ) => void,
) {
  return (level: LogEntry["level"], message: string) => {
    const entry: LogEntry = {
      id: ++logIdCounter,
      timestamp: dayjs().format("HH:mm:ss"),
      level,
      message,
    };
    set((s) => ({ logs: [...s.logs.slice(-500), entry] }));
  };
}

export function handleEvent(get: GetFn, set: SetFn) {
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
              [payload.site!]: {
                domain: payload.site!,
                total: 0,
                completed: 0,
                status: "scanning",
              },
            },
          }));
        }
        break;

      case "scan_done":
        if (payload.site) {
          set((s) => ({
            siteProgress: {
              ...s.siteProgress,
              [payload.site!]: {
                ...s.siteProgress[payload.site!],
                total: payload.total ?? 0,
                status: "downloading",
              },
            },
          }));
        }
        break;

      case "scan_complete": {
        const items = payload.items ?? [];
        const stats = payload.stats ?? null;
        const selectedUrls = new Set(items.filter((i) => !i.excluded_reason).map((i) => i.url));
        // Merge into a single set() call to avoid intermediate render with empty scanItems
        (set as (p: object) => void)({
          phase: "preview",
          scanItems: items,
          selectedUrls,
          scanStats: stats,
          stats,
        });
        addLog(
          "success",
          `扫描完成，共 ${items.filter((i) => !i.excluded_reason).length} 本待下载`,
        );
        break;
      }

      case "filter_done":
        if (payload.stats) {
          set({ stats: payload.stats } as Partial<EventHandlerState>);
          (set as (p: object) => void)({
            stats: payload.stats,
            overallTotal: payload.stats.final_download,
            status: "downloading",
          });
          addLog("info", `筛选完成：待下载 ${payload.stats.final_download} 本`);
        }
        break;

      case "chapter_done":
        if (payload.novel) {
          set((s) => {
            const now = Date.now();
            const newTimestamps = [...s.speed.chapterTimestamps, now];

            // Sum remaining chapters for novels currently in progress
            const activeNovels = Object.values(s.novelProgress);
            const activeRemaining = activeNovels.reduce(
              (acc, n) => acc + Math.max(0, n.total - n.current),
              0,
            );
            // Estimate remaining chapters for novels not yet started:
            // use the average chapter count of in-progress novels as a rough proxy.
            const pendingNovels = Math.max(0, s.overallTotal - s.overallCompleted - activeNovels.length);
            const avgChapters =
              activeNovels.length > 0
                ? activeNovels.reduce((acc, n) => acc + n.total, 0) / activeNovels.length
                : 0;
            const remainingChapters = activeRemaining + pendingNovels * avgChapters;

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

          // Match by URL first (unique), fall back to name+site match to avoid cross-site collision
          const scanItem = payload.url
            ? s.scanItems.find((i) => i.url === payload.url)
            : s.scanItems.find((i) => i.name === payload.novel && i.site === (payload.site ?? i.site));
          const results: NovelResult[] = payload.novel
            ? [
                ...s.novelResults,
                {
                  name: payload.novel,
                  url: scanItem?.url ?? payload.url ?? "",
                  site: scanItem?.site ?? payload.site ?? "",
                  date: scanItem?.date ?? "",
                  status: "success" as const,
                },
              ]
            : s.novelResults;

          return {
            overallCompleted: completed,
            siteProgress: updated,
            novelProgress: np,
            novelResults: results,
          };
        });
        if (payload.novel) addLog("success", `✓ ${payload.novel}`);
        break;

      case "novel_error":
        if (payload.novel) {
          set((s) => {
            // Match by URL first (unique), fall back to name+site match to avoid cross-site collision
            const scanItem = payload.url
              ? s.scanItems.find((i) => i.url === payload.url)
              : s.scanItems.find((i) => i.name === payload.novel && i.site === (payload.site ?? i.site));
            const site = payload.site;
            const updated = { ...s.siteProgress };
            if (site && updated[site]) {
              updated[site] = { ...updated[site], completed: updated[site].completed + 1 };
            }
            const np = { ...s.novelProgress };
            delete np[payload.novel!];
            return {
              overallCompleted: s.overallCompleted + 1,
              siteProgress: updated,
              novelProgress: np,
              novelResults: [
                ...s.novelResults,
                {
                  name: payload.novel!,
                  url: scanItem?.url ?? payload.url ?? "",
                  site: scanItem?.site ?? payload.site ?? "",
                  date: scanItem?.date ?? "",
                  status: "error" as const,
                  message: payload.message,
                },
              ],
            };
          });
          addLog("error", `✗ ${payload.novel}: ${payload.message ?? ""}`);
        }
        break;

      case "overall_done":
        (set as (p: object) => void)({ phase: "done", status: "done" });
        addLog("success", "所有任务完成！");
        break;
    }
  };
}

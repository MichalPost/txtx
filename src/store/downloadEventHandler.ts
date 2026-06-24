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
          const site = payload.site;
          set((s) => ({
            siteProgress: {
              ...s.siteProgress,
              [site]: {
                domain: site,
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
          const site = payload.site;
          set((s) => ({
            siteProgress: {
              ...s.siteProgress,
              [site]: {
                ...s.siteProgress[site],
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
        const selectedUrls = new Set(items.filter((item) => !item.excluded_reason).map((item) => item.url));

        (set as (p: object) => void)({
          phase: "preview",
          scanItems: items,
          selectedUrls,
          scanStats: stats,
          stats,
        });

        addLog("success", `扫描完成，共 ${items.filter((item) => !item.excluded_reason).length} 本待下载`);
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
          const novel = payload.novel;
          set((s) => {
            const now = Date.now();
            const newTimestamps = [...s.speed.chapterTimestamps, now];

            const activeNovels = Object.values(s.novelProgress);
            const activeRemaining = activeNovels.reduce(
              (acc, novel) => acc + Math.max(0, novel.total - novel.current),
              0,
            );
            const pendingNovels = Math.max(
              0,
              s.overallTotal - s.overallCompleted - activeNovels.length,
            );
            const avgChapters =
              activeNovels.length > 0
                ? activeNovels.reduce((acc, novel) => acc + novel.total, 0) / activeNovels.length
                : 0;
            const remainingChapters = activeRemaining + pendingNovels * avgChapters;

            return {
              novelProgress: {
                ...s.novelProgress,
                [novel]: {
                  name: novel,
                  current: payload.current ?? 0,
                  total: payload.total ?? 0,
                },
              },
              speed: computeSpeed(newTimestamps, remainingChapters),
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

          const nextNovelProgress = { ...s.novelProgress };
          if (payload.novel) delete nextNovelProgress[payload.novel];

          const scanItem = payload.url
            ? s.scanItems.find((item) => item.url === payload.url)
            : s.scanItems.find(
                (item) => item.name === payload.novel && item.site === (payload.site ?? item.site),
              );

          const results: NovelResult[] = payload.novel
            ? [
                ...s.novelResults,
                {
                  name: payload.novel,
                  url: scanItem?.url ?? payload.url ?? "",
                  site: scanItem?.site ?? payload.site ?? "",
                  date: scanItem?.date ?? "",
                  status: "success",
                },
              ]
            : s.novelResults;

          return {
            overallCompleted: completed,
            siteProgress: updated,
            novelProgress: nextNovelProgress,
            novelResults: results,
          };
        });

        if (payload.novel) {
          addLog("success", `下载成功：${payload.novel}`);
        }
        break;

      case "novel_error":
        if (payload.novel) {
          const novel = payload.novel;
          set((s) => {
            const scanItem = payload.url
              ? s.scanItems.find((item) => item.url === payload.url)
              : s.scanItems.find(
                  (item) => item.name === novel && item.site === (payload.site ?? item.site),
                );
            const site = payload.site;
            const updated = { ...s.siteProgress };
            if (site && updated[site]) {
              updated[site] = { ...updated[site], completed: updated[site].completed + 1 };
            }

            const nextNovelProgress = { ...s.novelProgress };
            delete nextNovelProgress[novel];

            return {
              overallCompleted: s.overallCompleted + 1,
              siteProgress: updated,
              novelProgress: nextNovelProgress,
              novelResults: [
                ...s.novelResults,
                {
                  name: novel,
                  url: scanItem?.url ?? payload.url ?? "",
                  site: scanItem?.site ?? payload.site ?? "",
                  date: scanItem?.date ?? "",
                  status: "error",
                  message: payload.message,
                },
              ],
            };
          });

          addLog("error", `下载失败：${novel}${payload.message ? `，${payload.message}` : ""}`);
        }
        break;

      case "overall_done":
        (set as (p: object) => void)({ phase: "done", status: "done" });
        addLog("success", "所有任务完成！");
        break;
    }
  };
}

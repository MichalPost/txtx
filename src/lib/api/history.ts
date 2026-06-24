import { invokeDesktopCommand } from "@/platform";
import type { HistoryEntry } from "@/types";

import { API_BASE, IS_TAURI } from "./constants";
import {
  buildHistoryQuerySearchParams,
  type HistoryQuerySort,
  type HistorySortField,
  type HistorySortOrder,
} from "./historyQueryParams";

export interface HistoryQuery extends HistoryQuerySort {}
export type { HistorySortField, HistorySortOrder };

export interface HistoryPageResult {
  entries: HistoryEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface DailyStat {
  date: string;
  success: number;
  error: number;
}
export interface SiteStat {
  site: string;
  count: number;
}
export interface HistoryStats {
  daily: DailyStat[];
  sites: SiteStat[];
  site_options: string[];
}

export interface HistorySiteOptionsResult {
  site_options: string[];
}

export async function apiGetHistory(): Promise<HistoryEntry[]> {
  if (IS_TAURI) {
    return invokeDesktopCommand<HistoryEntry[]>("get_history");
  }
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiQueryHistory(query: HistoryQuery): Promise<HistoryPageResult> {
  if (IS_TAURI) {
    return invokeDesktopCommand<HistoryPageResult>("query_history", { query });
  }
  const params = buildHistoryQuerySearchParams(query);
  const res = await fetch(`${API_BASE}/api/history/page?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiGetHistoryStats(days = 30): Promise<HistoryStats> {
  if (IS_TAURI) {
    return invokeDesktopCommand<HistoryStats>("get_history_stats", { days });
  }
  const res = await fetch(`${API_BASE}/api/history/stats?days=${days}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiGetHistorySiteOptions(): Promise<HistorySiteOptionsResult> {
  if (IS_TAURI) {
    return invokeDesktopCommand<HistorySiteOptionsResult>("get_history_site_options");
  }
  const res = await fetch(`${API_BASE}/api/history/sites`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiClearHistory(): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("clear_history");
  }
  const res = await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

import type { HistoryEntry } from "@/types";
import { IS_TAURI, API_BASE } from "./constants";

export interface HistoryQuery {
  page?: number;
  page_size?: number;
  search?: string;
  status?: "success" | "error" | "";
  site?: string;
}

export interface HistoryPageResult {
  entries: HistoryEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface DailyStat { date: string; success: number; error: number; }
export interface SiteStat { site: string; count: number; }
export interface HistoryStats { daily: DailyStat[]; sites: SiteStat[]; }

export async function apiGetHistory(): Promise<HistoryEntry[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<HistoryEntry[]>("get_history");
  }
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiQueryHistory(query: HistoryQuery): Promise<HistoryPageResult> {
  if (IS_TAURI) {
    // Tauri: full load + client-side filter
    const all = await apiGetHistory();
    let filtered = all;
    if (query.search) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter(e => e.name.toLowerCase().includes(q) || e.site.toLowerCase().includes(q));
    }
    if (query.status) filtered = filtered.filter(e => e.status === query.status);
    if (query.site) filtered = filtered.filter(e => e.site.includes(query.site!));
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 50;
    const start = (page - 1) * pageSize;
    return { entries: filtered.slice(start, start + pageSize), total: filtered.length, page, page_size: pageSize };
  }
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.site) params.set("site", query.site);
  const res = await fetch(`${API_BASE}/api/history/page?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiGetHistoryStats(days = 30): Promise<HistoryStats> {
  if (IS_TAURI) {
    const all = await apiGetHistory();
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const dailyMap: Record<string, { success: number; error: number }> = {};
    const siteMap: Record<string, number> = {};
    for (const e of all) {
      const day = e.downloaded_at.slice(0, 10);
      if (day >= cutoff) {
        if (!dailyMap[day]) dailyMap[day] = { success: 0, error: 0 };
        dailyMap[day][e.status as "success" | "error"]++;
      }
      if (e.status === "success") siteMap[e.site] = (siteMap[e.site] ?? 0) + 1;
    }
    const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
    const sites = Object.entries(siteMap).sort(([, a], [, b]) => b - a).slice(0, 20).map(([site, count]) => ({ site, count }));
    return { daily, sites };
  }
  const res = await fetch(`${API_BASE}/api/history/stats?days=${days}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiClearHistory(): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("clear_history");
  }
  await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
}

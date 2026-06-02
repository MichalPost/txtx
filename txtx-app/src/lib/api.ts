/**
 * API 抽象层
 *
 * 开发模式：直接请求 Rust HTTP 服务器 (http://localhost:3721)
 * Tauri 模式：通过 tauri invoke（编译时注入 VITE_TAURI_MODE=true）
 */

import type { AppConfig, BookCandidate, HistoryEntry, ProgressEvent, SiteHealth, ScanOptions } from "@/types";

const IS_TAURI = import.meta.env.VITE_TAURI_MODE === "true";
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3721";
const WS_BASE = API_BASE.replace(/^http/, "ws");

// ─── Config ───────────────────────────────────────────────────────────────────

export async function apiLoadConfig(): Promise<AppConfig> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<AppConfig>("load_config");
  }
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiSaveConfig(config: AppConfig): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("save_config", { config });
  }
  const res = await fetch(`${API_BASE}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Download ─────────────────────────────────────────────────────────────────

export type UnsubscribeFn = () => void;

/** Phase 1: scan all sites and return annotated list via ScanComplete event */
export function apiStartScan(
  onEvent: (ev: ProgressEvent) => void,
  options?: ScanOptions,
): UnsubscribeFn {
  if (IS_TAURI) {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const unlistenFn = await listen<ProgressEvent>("download_progress", (e) => {
        onEvent(e.payload);
      });
      unlisten = unlistenFn;
      if (!cancelled) {
        await invoke("start_scan", { options: options ?? null }).catch((e: unknown) => {
          onEvent({ type: "log", level: "error", message: String(e) });
        });
      }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }
  // WebSocket: send options as first message after connection
  const ws = new WebSocket(`${WS_BASE}/api/scan`);
  ws.onopen = () => {
    if (options) ws.send(JSON.stringify(options));
  };
  ws.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data as string)); } catch { /* ignore */ }
  };
  ws.onerror = () => {
    onEvent({ type: "log", level: "error", message: "WebSocket 连接失败，请确认后端已启动" });
  };
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.send("stop");
      ws.close();
    }
  };
}

/** Phase 3: download only the user-selected candidates */
export function apiStartSelectedDownload(
  selected: BookCandidate[],
  onEvent: (ev: ProgressEvent) => void,
): UnsubscribeFn {
  if (IS_TAURI) {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const unlistenFn = await listen<ProgressEvent>("download_progress", (e) => {
        onEvent(e.payload);
      });
      unlisten = unlistenFn;
      if (!cancelled) {
        await invoke("download_selected", { selected }).catch((e: unknown) => {
          onEvent({ type: "log", level: "error", message: String(e) });
        });
      }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }
  // WebSocket: send selected list as first message
  const ws = new WebSocket(`${WS_BASE}/api/download/selected`);
  ws.onopen = () => {
    ws.send(JSON.stringify(selected));
  };
  ws.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data as string)); } catch { /* ignore */ }
  };
  ws.onerror = () => {
    onEvent({ type: "log", level: "error", message: "WebSocket 连接失败，请确认后端已启动" });
  };
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.send("stop");
      ws.close();
    }
  };
}

export function apiStartDownload(onEvent: (ev: ProgressEvent) => void): UnsubscribeFn {
  if (IS_TAURI) {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const unlistenFn = await listen<ProgressEvent>("download_progress", (e) => {
        onEvent(e.payload);
      });
      unlisten = unlistenFn;
      if (!cancelled) {
        await invoke("start_download").catch((e: unknown) => {
          onEvent({ type: "log", level: "error", message: String(e) });
        });
      }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }
  return makeWsDownload(`${WS_BASE}/api/download`, onEvent);
}

export function apiStartSingleDownload(
  url: string,
  onEvent: (ev: ProgressEvent) => void
): UnsubscribeFn {
  if (IS_TAURI) {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const unlistenFn = await listen<ProgressEvent>("download_progress", (e) => {
        onEvent(e.payload);
      });
      unlisten = unlistenFn;
      if (!cancelled) {
        await invoke("download_single", { url }).catch((e: unknown) => {
          onEvent({ type: "log", level: "error", message: String(e) });
        });
      }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }
  const wsUrl = `${WS_BASE}/api/download/single?url=${encodeURIComponent(url)}`;
  return makeWsDownload(wsUrl, onEvent);
}

function makeWsDownload(wsUrl: string, onEvent: (ev: ProgressEvent) => void): UnsubscribeFn {
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data as string)); } catch { /* ignore */ }
  };
  ws.onerror = () => {
    onEvent({ type: "log", level: "error", message: "WebSocket 连接失败，请确认后端已启动" });
  };
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.send("stop");
      ws.close();
    }
  };
}
export async function apiStopDownload(): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("stop_download");
  }
  await fetch(`${API_BASE}/api/stop`, { method: "POST" });
}

// ─── File picker ──────────────────────────────────────────────────────────────

export async function apiPickDirectory(): Promise<string | null> {
  if (IS_TAURI) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({ directory: true, multiple: false });
    return result as string | null;
  }
  return null;
}

export async function apiPickFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (IS_TAURI) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({ multiple: false, filters });
    return result as string | null;
  }
  return null;
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function apiGetHistory(): Promise<HistoryEntry[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<HistoryEntry[]>("get_history");
  }
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

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

export async function apiQueryHistory(query: HistoryQuery): Promise<HistoryPageResult> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.site) params.set("site", query.site);

  if (IS_TAURI) {
    // Tauri: fall back to full load + client-side filter for now
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
    return {
      entries: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    };
  }
  const res = await fetch(`${API_BASE}/api/history/page?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface DailyStat { date: string; success: number; error: number; }
export interface SiteStat { site: string; count: number; }
export interface HistoryStats { daily: DailyStat[]; sites: SiteStat[]; }

export async function apiGetHistoryStats(days = 30): Promise<HistoryStats> {
  if (IS_TAURI) {
    // Compute stats from full history on Tauri
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
    const daily = Object.entries(dailyMap).sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date,...v}));
    const sites = Object.entries(siteMap).sort(([,a],[,b])=>b-a).slice(0,20).map(([site,count])=>({site,count}));
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

// ─── Site health check ────────────────────────────────────────────────────────

export async function apiCheckSites(): Promise<SiteHealth[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<SiteHealth[]>("check_sites");
  }
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Text conversion ──────────────────────────────────────────────────────────

export async function apiConvertFile(path: string): Promise<string> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("convert_file", { path });
  }
  const res = await fetch(`${API_BASE}/api/convert/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.changed ? `已转换: ${path}` : `无需转换: ${path}`;
}

// ─── Download Queue ───────────────────────────────────────────────────────────

export async function apiGetQueue(): Promise<import("@/types").QueueStatus> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<import("@/types").QueueStatus>("get_queue");
  }
  const res = await fetch(`${API_BASE}/api/queue`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiClearQueue(): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("clear_queue");
  }
  await fetch(`${API_BASE}/api/queue`, { method: "DELETE" });
}

// ─── Novel name preview ───────────────────────────────────────────────────────

export async function apiPreviewNovelName(url: string): Promise<string | null> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ name: string | null }>("preview_novel_name", { url });
    return result.name;
  }
  const res = await fetch(`${API_BASE}/api/novel-name?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.name ?? null;
}

// ─── Open output directory ────────────────────────────────────────────────────

export async function apiOpenOutputDir(): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("open_output_dir");
  }
  // In web/dev mode, not supported
}

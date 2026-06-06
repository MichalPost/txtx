import type { BookCandidate, ProgressEvent, ScanOptions } from "@/types";

import { API_BASE, IS_TAURI, WS_BASE } from "./constants";

export type UnsubscribeFn = () => void;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function makeWsDownload(wsUrl: string, onEvent: (ev: ProgressEvent) => void): UnsubscribeFn {
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data as string));
    } catch {
      /* ignore */
    }
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

function makeTauriDownload(
  invokeCmd: string,
  invokeArgs: Record<string, unknown>,
  onEvent: (ev: ProgressEvent) => void,
): UnsubscribeFn {
  let unlisten: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<ProgressEvent>("download_progress", (e) => onEvent(e.payload));
    if (!cancelled) {
      await invoke(invokeCmd, invokeArgs).catch((e: unknown) => {
        onEvent({ type: "log", level: "error", message: String(e) });
      });
    }
  })();
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Phase 1: scan all sites and return annotated list via ScanComplete event */
export function apiStartScan(
  onEvent: (ev: ProgressEvent) => void,
  options?: ScanOptions,
): UnsubscribeFn {
  if (IS_TAURI) {
    return makeTauriDownload("start_scan", { options: options ?? null }, onEvent);
  }
  const ws = new WebSocket(`${WS_BASE}/api/scan`);
  ws.onopen = () => {
    if (options) ws.send(JSON.stringify(options));
  };
  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data as string));
    } catch {
      /* ignore */
    }
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
    return makeTauriDownload("download_selected", { selected }, onEvent);
  }
  const ws = new WebSocket(`${WS_BASE}/api/download/selected`);
  ws.onopen = () => {
    ws.send(JSON.stringify(selected));
  };
  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data as string));
    } catch {
      /* ignore */
    }
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
    return makeTauriDownload("start_download", {}, onEvent);
  }
  return makeWsDownload(`${WS_BASE}/api/download`, onEvent);
}

export function apiStartSingleDownload(
  url: string,
  onEvent: (ev: ProgressEvent) => void,
): UnsubscribeFn {
  if (IS_TAURI) {
    return makeTauriDownload("download_single", { url }, onEvent);
  }
  return makeWsDownload(`${WS_BASE}/api/download/single?url=${encodeURIComponent(url)}`, onEvent);
}

export async function apiStopDownload(): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("stop_download");
  }
  await fetch(`${API_BASE}/api/stop`, { method: "POST" });
}

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

export async function apiOpenOutputDir(): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("open_output_dir");
  }
  // In web/dev mode, not supported
}

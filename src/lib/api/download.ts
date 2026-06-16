import type { BookCandidate, ProgressEvent, ScanOptions, TaskEvent } from "@/types";
import { startDesktopTaskSession } from "@/platform/desktopTaskSession";
import { invokeDesktopCommand, listenDesktopEvent } from "@/platform";

import { API_BASE, IS_TAURI, WS_BASE } from "./constants";

export type UnsubscribeFn = () => void;

async function ensureOkResponse(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;
  const message = (await response.text().catch(() => "")).trim();
  throw new Error(message || fallbackMessage);
}

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
    // Only send "stop" when the connection is fully open; close regardless
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send("stop");
      } catch {
        /* ignore send errors */
      }
    }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

function makeTauriDownload(
  invokeCmd: string,
  invokeArgs: Record<string, unknown>,
  onEvent: (ev: ProgressEvent) => void,
): UnsubscribeFn {
  return startDesktopTaskSession<TaskEvent, ProgressEvent>(
    {
      invokeDesktopCommand,
      listenDesktopEvent,
    },
    {
      command: invokeCmd,
      args: invokeArgs,
      eventName: "task_event",
      mapEvent: ({ task_id, ...event }) => {
        void task_id;
        return event as ProgressEvent;
      },
      onEvent,
      onError: (error) => {
        onEvent({ type: "log", level: "error", message: String(error) });
      },
    },
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Phase 1: scan all sites and return annotated list via ScanComplete event */
export function apiStartScan(
  onEvent: (ev: ProgressEvent) => void,
  options?: ScanOptions,
): UnsubscribeFn {
  if (IS_TAURI) {
    return makeTauriDownload("create_scan_task", { options: options ?? null }, onEvent);
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
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send("stop");
      } catch {
        /* ignore send errors */
      }
    }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
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
    return makeTauriDownload("create_selected_download_task", { selected }, onEvent);
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
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send("stop");
      } catch {
        /* ignore send errors */
      }
    }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

export function apiStartDownload(onEvent: (ev: ProgressEvent) => void): UnsubscribeFn {
  if (IS_TAURI) {
    return makeTauriDownload("create_batch_download_task", { options: null }, onEvent);
  }
  return makeWsDownload(`${WS_BASE}/api/download`, onEvent);
}

export function apiStartSingleDownload(
  url: string,
  onEvent: (ev: ProgressEvent) => void,
): UnsubscribeFn {
  if (IS_TAURI) {
    return makeTauriDownload("create_single_download_task", { url }, onEvent);
  }
  return makeWsDownload(`${WS_BASE}/api/download/single?url=${encodeURIComponent(url)}`, onEvent);
}

export async function apiStopDownload(): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("cancel_active_tasks");
  }
  const res = await fetch(`${API_BASE}/api/stop`, { method: "POST" });
  await ensureOkResponse(res, "停止下载失败");
}

export async function apiGetQueue(): Promise<import("@/types").QueueStatus> {
  if (IS_TAURI) {
    return invokeDesktopCommand<import("@/types").QueueStatus>("get_queue");
  }
  const res = await fetch(`${API_BASE}/api/queue`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiClearQueue(): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("clear_queue");
  }
  const res = await fetch(`${API_BASE}/api/queue`, { method: "DELETE" });
  await ensureOkResponse(res, "清除下载队列失败");
}

export async function apiPreviewNovelName(url: string): Promise<string | null> {
  if (IS_TAURI) {
    const result = await invokeDesktopCommand<{ name: string | null }>("preview_novel_name", {
      url,
    });
    return result.name;
  }
  const res = await fetch(`${API_BASE}/api/novel-name?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.name ?? null;
}

export async function apiOpenOutputDir(): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("open_output_dir");
  }
  // In web/dev mode, not supported
}

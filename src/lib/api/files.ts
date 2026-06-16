import type { SiteHealth } from "@/types";
import {
  invokeDesktopCommand,
  openNativeDialog,
  PLATFORM_CAPABILITIES,
  saveNativeDialog,
  writeLocalTextFile,
} from "@/platform";
import { resolveSaveTextFilePlan } from "@/lib/saveTextFileStrategy";

import { API_BASE, IS_TAURI } from "./constants";

export async function apiPickDirectory(): Promise<string | null> {
  if (IS_TAURI) {
    return openNativeDialog({ directory: true, multiple: false });
  }
  // Dev mode: fall back to a prompt so the field is still editable
  const input = window.prompt("请输入目录路径：");
  return input?.trim() || null;
}

export async function apiPickFile(
  filters?: { name: string; extensions: string[] }[],
): Promise<string | null> {
  if (IS_TAURI) {
    return openNativeDialog({ multiple: false, filters });
  }
  // Dev mode: fall back to a prompt
  const ext = filters?.flatMap((f) => f.extensions).join(", ") ?? "";
  const input = window.prompt(`请输入文件路径${ext ? `（${ext}）` : ""}：`);
  return input?.trim() || null;
}

export async function apiCheckSites(): Promise<SiteHealth[]> {
  if (IS_TAURI) {
    return invokeDesktopCommand<SiteHealth[]>("check_sites");
  }
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiConvertFile(path: string): Promise<string> {
  if (IS_TAURI) {
    return invokeDesktopCommand<string>("convert_file", { path });
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

/** Save text content as a file download. In dev mode uses browser download; in Tauri uses save dialog. */
export async function apiSaveTextFile(filename: string, content: string): Promise<void> {
  if (IS_TAURI) {
    const path = await saveNativeDialog({
      defaultPath: filename,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    const plan = resolveSaveTextFilePlan({
      isTauri: true,
      canReadLocalFiles: PLATFORM_CAPABILITIES.canReadLocalFiles,
      selectedPath: path,
    });
    if (plan.action === "write-local") {
      await writeLocalTextFile(plan.path, content);
    }
    return;
  }
  const plan = resolveSaveTextFilePlan({
    isTauri: false,
    canReadLocalFiles: PLATFORM_CAPABILITIES.canReadLocalFiles,
    selectedPath: null,
  });
  if (plan.action === "browser-download") {
    _browserDownload(filename, content);
  }
}

function _browserDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fetch raw HTML source of a URL via backend proxy (avoids CORS in browser). */
export async function apiFetchSource(url: string): Promise<string> {
  if (IS_TAURI) {
    return invokeDesktopCommand<string>("fetch_source", { url });
  }
  const res = await fetch(`${API_BASE}/api/source?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { html: string };
  return data.html;
}

/**
 * Try to auto-detect the calibre ebook-convert executable path.
 * Returns null if not found.
 */
export async function apiDetectCalibre(): Promise<string | null> {
  if (IS_TAURI) {
    return invokeDesktopCommand<string | null>("detect_calibre");
  }
  // In dev/web mode, try via REST
  const res = await fetch(`${API_BASE}/api/calibre/detect`).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data as { path?: string } | null)?.path ?? null;
}

/** Merge multiple txt files into one output file. Returns a status message. */
export async function apiMergeFiles(paths: string[], output: string): Promise<string> {
  if (IS_TAURI) {
    return invokeDesktopCommand<string>("merge_files", { paths, output });
  }
  const res = await fetch(`${API_BASE}/api/tools/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, output }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data as { message: string }).message;
}

/** Split a txt file into multiple files by chapter headings. Returns list of output paths. */
export async function apiSplitFile(path: string, pattern?: string): Promise<string[]> {
  if (IS_TAURI) {
    return invokeDesktopCommand<string[]>("split_file", { path, pattern: pattern ?? null });
  }
  const res = await fetch(`${API_BASE}/api/tools/split`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, pattern: pattern ?? null }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

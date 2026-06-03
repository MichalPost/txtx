import type { SiteHealth } from "@/types";
import { IS_TAURI, API_BASE } from "./constants";

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

export async function apiCheckSites(): Promise<SiteHealth[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<SiteHealth[]>("check_sites");
  }
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

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

/** Save text content as a file download. In dev mode uses browser download; in Tauri uses save dialog. */
export async function apiSaveTextFile(filename: string, content: string): Promise<void> {
  if (IS_TAURI) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      // Use Function constructor to avoid TypeScript static module resolution
      // plugin-fs is available at Tauri runtime but not installed as a dev dependency
      const fs = await new Function('m', 'return import(m)')("@tauri-apps/plugin-fs").catch(() => null);
      const path = await save({
        defaultPath: filename,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path && fs) await fs.writeTextFile(path, content);
    } catch {
      // fallback to browser download if Tauri APIs unavailable
      _browserDownload(filename, content);
    }
    return;
  }
  _browserDownload(filename, content);
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
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("fetch_source", { url });
  }
  const res = await fetch(`${API_BASE}/api/source?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json() as { html: string };
  return data.html;
}

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

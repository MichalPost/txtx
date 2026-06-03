import type { AppConfig } from "@/types";
import { IS_TAURI, API_BASE } from "./constants";

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

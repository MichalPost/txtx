import type { AppConfig } from "@/types";
import { invokeDesktopCommand } from "@/platform";

import { API_BASE, IS_TAURI } from "./constants";

export async function apiLoadConfig(): Promise<AppConfig> {
  if (IS_TAURI) {
    return invokeDesktopCommand<AppConfig>("load_config");
  }
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiSaveConfig(config: AppConfig): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("save_config", { config });
  }
  const res = await fetch(`${API_BASE}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
}

/** Returns true if this is the first time the app has been launched (setup not complete). */
export async function apiCheckFirstRun(): Promise<boolean> {
  if (IS_TAURI) {
    return invokeDesktopCommand<boolean>("check_first_run");
  }
  // In server/dev mode, never show the wizard.
  return false;
}

/** Called by the setup wizard to write base_dir and mark setup complete. */
export async function apiCompleteSetup(baseDir: string): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("complete_setup", { baseDir });
  }
  // No-op in server mode.
}

/** Open a native folder-picker dialog; returns the chosen path or null. */
// Note: apiPickDirectory is already exported from ./files — import from "@/lib/api" directly.

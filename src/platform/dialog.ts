import { PLATFORM_KIND } from "./runtime";

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

interface OpenDialogOptions {
  directory?: boolean;
  filters?: FileDialogFilter[];
  multiple?: boolean;
}

interface SaveDialogOptions {
  defaultPath: string;
  filters?: FileDialogFilter[];
}

export async function openNativeDialog(options: OpenDialogOptions): Promise<string | null> {
  if (PLATFORM_KIND !== "desktop") {
    return null;
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open(options);
  return typeof result === "string" ? result : null;
}

export async function saveNativeDialog(options: SaveDialogOptions): Promise<string | null> {
  if (PLATFORM_KIND !== "desktop") {
    return null;
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const result = await save(options);
  return typeof result === "string" ? result : null;
}

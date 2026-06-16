export interface ResolveSaveTextFilePlanInput {
  isTauri: boolean;
  canReadLocalFiles: boolean;
  selectedPath: string | null;
}

export type SaveTextFilePlan =
  | { action: "browser-download" }
  | { action: "skip" }
  | { action: "write-local"; path: string };

export function resolveSaveTextFilePlan({
  isTauri,
  canReadLocalFiles,
  selectedPath,
}: ResolveSaveTextFilePlanInput): SaveTextFilePlan {
  if (!isTauri) {
    return { action: "browser-download" };
  }

  if (!selectedPath) {
    return { action: "skip" };
  }

  if (!canReadLocalFiles) {
    throw new Error("桌面文件系统插件不可用，无法保存导出文件");
  }

  return { action: "write-local", path: selectedPath };
}

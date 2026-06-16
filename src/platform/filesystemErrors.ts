import type { PlatformKind } from "./runtime.ts";

export type FilesystemOperation = "read" | "write";

export function createFilesystemUnavailableError(
  operation: FilesystemOperation,
  platformKind: PlatformKind,
): Error {
  const action = operation === "read" ? "读取" : "写入";

  if (platformKind !== "desktop") {
    return new Error(`当前运行环境不支持本地文件${action}`);
  }

  return new Error(`桌面文件系统插件不可用，无法${action}本地文件`);
}

import { createFilesystemUnavailableError } from "./filesystemErrors";
import { loadTauriFilesystemModule, resolveFilesystemModuleState } from "./filesystemLoader";
import { PLATFORM_CAPABILITIES, PLATFORM_KIND } from "./runtime";

export async function readLocalTextFile(path: string): Promise<string> {
  const state = await resolveFilesystemModuleState({
    canReadLocalFiles: PLATFORM_CAPABILITIES.canReadLocalFiles,
    loadModule: loadTauriFilesystemModule,
  });
  if (state.kind !== "ready") {
    throw createFilesystemUnavailableError("read", PLATFORM_KIND);
  }

  return state.module.readTextFile(path);
}

export async function writeLocalTextFile(path: string, content: string): Promise<void> {
  const state = await resolveFilesystemModuleState({
    canReadLocalFiles: PLATFORM_CAPABILITIES.canReadLocalFiles,
    loadModule: loadTauriFilesystemModule,
  });
  if (state.kind !== "ready") {
    throw createFilesystemUnavailableError("write", PLATFORM_KIND);
  }

  await state.module.writeTextFile(path, content);
}

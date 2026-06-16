export {
  PLATFORM_CAPABILITIES,
  PLATFORM_KIND,
  detectPlatformKind,
  getPlatformCapabilities,
  resolvePlatformKind,
  type PlatformCapabilities,
  type PlatformDetectionInput,
  type PlatformKind,
} from "./runtime";
export { readLocalTextFile, writeLocalTextFile } from "./filesystem";
export {
  createTauriFilesystemLoader,
  loadTauriFilesystemModule,
  resolveFilesystemModuleState,
  type FilesystemModuleState,
  type TauriFsModule,
} from "./filesystemLoader";
export { openNativeDialog, saveNativeDialog, type FileDialogFilter } from "./dialog";
export {
  invokeDesktopCommand,
  listenDesktopEvent,
  type PlatformEvent,
  type PlatformUnlisten,
} from "./tauri";

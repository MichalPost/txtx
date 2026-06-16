export interface TauriFsModule {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
}

export type FilesystemModuleState =
  | { kind: "unsupported-platform" }
  | { kind: "plugin-unavailable" }
  | { kind: "ready"; module: TauriFsModule };

export async function resolveFilesystemModuleState({
  canReadLocalFiles,
  loadModule,
}: {
  canReadLocalFiles: boolean;
  loadModule: () => Promise<TauriFsModule | null>;
}): Promise<FilesystemModuleState> {
  if (!canReadLocalFiles) {
    return { kind: "unsupported-platform" };
  }

  const module = await loadModule();
  if (!module) {
    return { kind: "plugin-unavailable" };
  }

  return { kind: "ready", module };
}

export function createTauriFilesystemLoader(
  dynamicImport: (moduleName: string) => Promise<TauriFsModule | null>,
): () => Promise<TauriFsModule | null> {
  return () => dynamicImport("@tauri-apps/plugin-fs");
}

export const loadTauriFilesystemModule = createTauriFilesystemLoader((moduleName) =>
  new Function("m", "return import(m)")(moduleName).catch(() => null) as Promise<TauriFsModule | null>,
);

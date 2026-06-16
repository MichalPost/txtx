export type PlatformKind = "web" | "desktop";

export interface PlatformDetectionInput {
  tauriMode?: string | undefined;
  hasTauriInternals?: boolean;
}

export interface PlatformCapabilities {
  canReadLocalFiles: boolean;
  canUseNativeDialogs: boolean;
  kind: PlatformKind;
}

export function resolvePlatformKind(input: PlatformDetectionInput): PlatformKind {
  if (input.tauriMode === "true" || input.hasTauriInternals) {
    return "desktop";
  }

  return "web";
}

export function detectPlatformKind(): PlatformKind {
  const hasWindow = typeof window !== "undefined";
  const viteMeta = import.meta as ImportMeta & {
    env?: {
      VITE_TAURI_MODE?: string;
    };
  };
  const hasTauriInternals =
    hasWindow &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
      "undefined";

  return resolvePlatformKind({
    tauriMode: viteMeta.env?.VITE_TAURI_MODE,
    hasTauriInternals,
  });
}

export function getPlatformCapabilities(kind: PlatformKind): PlatformCapabilities {
  return {
    canReadLocalFiles: kind === "desktop",
    canUseNativeDialogs: kind === "desktop",
    kind,
  };
}

export const PLATFORM_KIND = detectPlatformKind();
export const PLATFORM_CAPABILITIES = getPlatformCapabilities(PLATFORM_KIND);

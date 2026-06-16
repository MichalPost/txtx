import { PLATFORM_KIND } from "./runtime";

export type PlatformUnlisten = () => void;

export interface PlatformEvent<TPayload> {
  payload: TPayload;
}

export async function invokeDesktopCommand<TResult>(
  command: string,
  args?: Record<string, unknown>,
): Promise<TResult> {
  if (PLATFORM_KIND !== "desktop") {
    throw new Error(`桌面命令仅在 desktop 平台可用: ${command}`);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TResult>(command, args);
}

export async function listenDesktopEvent<TPayload>(
  eventName: string,
  handler: (event: PlatformEvent<TPayload>) => void,
): Promise<PlatformUnlisten> {
  if (PLATFORM_KIND !== "desktop") {
    throw new Error(`桌面事件仅在 desktop 平台可用: ${eventName}`);
  }

  const { listen } = await import("@tauri-apps/api/event");
  return listen<TPayload>(eventName, (event) => {
    handler({ payload: event.payload });
  });
}

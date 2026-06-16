import type { PlatformEvent, PlatformUnlisten } from "./tauri";

export interface DesktopTaskSessionApi<TPayload> {
  invokeDesktopCommand(command: string, args?: Record<string, unknown>): Promise<unknown>;
  listenDesktopEvent(
    eventName: string,
    handler: (event: PlatformEvent<TPayload>) => void,
  ): Promise<PlatformUnlisten>;
}

export interface StartDesktopTaskSessionOptions<TPayload, TEvent> {
  command: string;
  args?: Record<string, unknown>;
  eventName: string;
  mapEvent?: (payload: TPayload) => TEvent;
  onEvent: (event: TEvent) => void;
  onError: (error: unknown) => void;
}

export function startDesktopTaskSession<TPayload, TEvent = TPayload>(
  api: DesktopTaskSessionApi<TPayload>,
  options: StartDesktopTaskSessionOptions<TPayload, TEvent>,
): PlatformUnlisten {
  let unlisten: PlatformUnlisten | null = null;
  let cancelled = false;

  void (async () => {
    try {
      unlisten = await api.listenDesktopEvent(options.eventName, (event) => {
        if (cancelled) {
          return;
        }

        const mapped = options.mapEvent
          ? options.mapEvent(event.payload)
          : (event.payload as unknown as TEvent);
        onMappedEvent(mapped, options.onEvent);
      });

      if (cancelled) {
        unlisten();
        unlisten = null;
        return;
      }

      try {
        await api.invokeDesktopCommand(options.command, options.args);
      } catch (error) {
        unlisten?.();
        unlisten = null;
        options.onError(error);
      }
    } catch (error) {
      options.onError(error);
    }
  })();

  return () => {
    cancelled = true;
    unlisten?.();
    unlisten = null;
  };
}

function onMappedEvent<TEvent>(event: TEvent, onEvent: (event: TEvent) => void): void {
  onEvent(event);
}

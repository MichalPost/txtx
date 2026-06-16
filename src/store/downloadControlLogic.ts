import type { DownloadPhase } from "./downloadStore";

export function getDownloadRunState(): { phase: DownloadPhase; status: "downloading" } {
  return {
    phase: "downloading",
    status: "downloading",
  };
}

export async function stopDownloadAndUpdateState(
  stopRemote: () => Promise<void>,
  onStopped: () => void,
): Promise<void> {
  await stopRemote();
  onStopped();
}

export async function pauseDownloadAndUpdateState(
  stopRemote: () => Promise<void>,
  onPaused: () => Promise<void>,
): Promise<void> {
  await stopRemote();
  await onPaused();
}

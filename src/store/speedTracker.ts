/** 速度追踪：基于滑动时间窗口计算章节下载速度和剩余时间 */

const SPEED_WINDOW_MS = 10_000; // 10 second sliding window

export interface SpeedState {
  /** Timestamps (ms) of recent chapter_done events */
  chapterTimestamps: number[];
  /** Chapters/second (smoothed) */
  chaptersPerSecond: number;
  /** Estimated seconds remaining (-1 = unknown) */
  etaSeconds: number;
}

export const initialSpeed: SpeedState = {
  chapterTimestamps: [],
  chaptersPerSecond: 0,
  etaSeconds: -1,
};

export function computeSpeed(timestamps: number[], remainingChapters: number): SpeedState {
  const now = Date.now();
  const recent = timestamps.filter((t) => now - t < SPEED_WINDOW_MS);
  const cps = recent.length / (SPEED_WINDOW_MS / 1000);
  const eta = cps > 0 ? Math.round(remainingChapters / cps) : -1;
  return { chapterTimestamps: recent, chaptersPerSecond: cps, etaSeconds: eta };
}

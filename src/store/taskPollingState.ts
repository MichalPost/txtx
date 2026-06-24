export interface TaskPollState {
  pollError: string | null;
  pollErrorVersion: number;
  pollFailureCount: number;
  nextPollDelayMs: number;
  lastRecoveredAt: string | null;
}

const POLL_BACKOFF_STEPS_MS = [2000, 5000, 10_000, 30_000] as const;
const IDLE_ROUTE_POLL_DELAY_MS = 15_000;
const HIDDEN_TAB_POLL_DELAY_MS = 30_000;

export function getTaskPollDelayMs(failureCount: number): number {
  const index = Math.min(Math.max(0, failureCount - 1), POLL_BACKOFF_STEPS_MS.length - 1);
  return POLL_BACKOFF_STEPS_MS[index];
}

export function getTaskPollScheduleDelayMs(args: {
  baseDelayMs: number;
  hasRunningTask: boolean;
  isDocumentVisible: boolean;
  isTaskRoute: boolean;
}): number {
  if (!args.isDocumentVisible) {
    return Math.max(args.baseDelayMs, HIDDEN_TAB_POLL_DELAY_MS);
  }
  if (args.isTaskRoute || args.hasRunningTask) {
    return args.baseDelayMs;
  }
  return Math.max(args.baseDelayMs, IDLE_ROUTE_POLL_DELAY_MS);
}

export function applyTaskPollFailure(state: TaskPollState, error: unknown): TaskPollState {
  const message = error instanceof Error ? error.message : String(error);
  const failureCount = state.pollFailureCount + 1;
  const nextPollDelayMs = getTaskPollDelayMs(failureCount);
  if (
    state.pollError === message &&
    state.pollFailureCount === failureCount &&
    state.nextPollDelayMs === nextPollDelayMs
  ) {
    return state;
  }
  return {
    pollError: message,
    pollErrorVersion: state.pollError === message ? state.pollErrorVersion : state.pollErrorVersion + 1,
    pollFailureCount: failureCount,
    nextPollDelayMs,
    lastRecoveredAt: state.lastRecoveredAt,
  };
}

export function applyTaskPollSuccess(state: TaskPollState, recoveredAt = new Date()): TaskPollState {
  if (state.pollError === null && state.pollFailureCount === 0 && state.nextPollDelayMs === 2000) {
    return state;
  }
  return {
    pollError: null,
    pollErrorVersion: state.pollErrorVersion,
    pollFailureCount: 0,
    nextPollDelayMs: getTaskPollDelayMs(0),
    lastRecoveredAt: state.pollError ? recoveredAt.toISOString() : state.lastRecoveredAt,
  };
}

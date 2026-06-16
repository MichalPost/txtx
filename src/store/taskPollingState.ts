export interface TaskPollState {
  pollError: string | null;
  pollErrorVersion: number;
}

export function applyTaskPollFailure(state: TaskPollState, error: unknown): TaskPollState {
  const message = error instanceof Error ? error.message : String(error);
  if (state.pollError === message) return state;
  return {
    pollError: message,
    pollErrorVersion: state.pollErrorVersion + 1,
  };
}

export function applyTaskPollSuccess(state: TaskPollState): TaskPollState {
  if (state.pollError === null) return state;
  return {
    pollError: null,
    pollErrorVersion: state.pollErrorVersion,
  };
}

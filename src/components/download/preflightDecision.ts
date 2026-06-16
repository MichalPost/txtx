export interface PreflightDecisionInput {
  done: boolean;
  error: string;
}

export function canContinueWithPreflight({ done, error }: PreflightDecisionInput): boolean {
  return done && !error;
}

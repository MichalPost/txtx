import { shouldRunScheduledTask } from "./schedulerLogic.ts";

export interface ScheduledBatchTaskRunInput {
  now: Date;
  targetHour: number;
  lastRun: string | null;
  createTask: () => Promise<unknown>;
  markRan: () => void;
  onError: (error: unknown) => void;
}

export async function runScheduledBatchTask({
  now,
  targetHour,
  lastRun,
  createTask,
  markRan,
  onError,
}: ScheduledBatchTaskRunInput): Promise<void> {
  if (!shouldRunScheduledTask({ now, targetHour, lastRun })) {
    return;
  }

  try {
    await createTask();
    markRan();
  } catch (error) {
    onError(error);
  }
}

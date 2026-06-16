export interface ScheduledTaskCheckInput {
  now: Date;
  targetHour: number;
  lastRun: string | null;
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shouldRunScheduledTask({
  now,
  targetHour,
  lastRun,
}: ScheduledTaskCheckInput): boolean {
  return now.getHours() === targetHour && lastRun !== formatLocalDateKey(now);
}

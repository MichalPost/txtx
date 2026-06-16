export function formatTaskRetryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `重新发起任务失败：${message}`;
}

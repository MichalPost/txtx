export function formatTaskActionError(actionLabel: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${actionLabel}失败：${message}`;
}

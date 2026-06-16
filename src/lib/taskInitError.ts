export function formatTaskInitError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `初始化任务列表失败：${message}`;
}

export function formatCreateScanTaskError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `创建扫描任务失败：${message}`;
}

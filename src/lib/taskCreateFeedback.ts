export type TaskCreateKind = "scan" | "batch" | "single" | "retry" | "multi_single";

export function formatTaskCreateError(kind: TaskCreateKind, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const label =
    kind === "scan"
      ? "创建扫描任务"
      : kind === "batch"
        ? "创建批量下载任务"
        : kind === "single"
          ? "创建单本下载任务"
          : kind === "retry"
            ? "重新发起任务"
            : "批量创建下载任务";
  return `${label}失败：${message}`;
}

export function formatTaskCreateSuccess(kind: TaskCreateKind, count = 1): string {
  if (kind === "scan") {
    return "已创建扫描任务，请在任务管理确认书单并开始下载";
  }
  if (kind === "single") {
    return "已创建单本下载任务，请在任务管理查看进度";
  }
  if (kind === "retry") {
    return "已重新发起任务，请前往任务管理查看";
  }
  if (kind === "multi_single") {
    return `已创建 ${count} 个下载任务，请前往「任务管理」查看`;
  }
  return "已创建批量下载任务，请前往任务管理查看";
}

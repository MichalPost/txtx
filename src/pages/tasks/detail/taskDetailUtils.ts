import type { LogEntry, TaskRecord } from "@/types";

export interface TaskRetryAction {
  canRun: boolean;
  idleLabel: string;
  pendingLabel: string;
  unavailableReason: string;
}

export function getRecentFailureMessages(logs: LogEntry[], limit = 5): string[] {
  const seen = new Set<string>();
  const messages: string[] = [];

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const log = logs[index];
    if (log.level !== "error") continue;

    const message = log.message.trim();
    if (!message || seen.has(message)) continue;

    seen.add(message);
    messages.push(message);
    if (messages.length >= limit) break;
  }

  return messages;
}

export function buildFailedLogReport(task: TaskRecord, failedMessages: string[]): string {
  const lines = [
    `任务：${task.label}`,
    `任务 ID：${task.id}`,
    `状态：${task.status}`,
    `创建时间：${task.created_at}`,
    `完成时间：${task.finished_at ?? "未完成"}`,
    `总数：${task.total}`,
    `成功：${task.success_count}`,
    `失败：${task.error_count}`,
  ];

  if (task.source_url) {
    lines.push(`来源链接：${task.source_url}`);
  }

  if (task.error_message) {
    lines.push(`任务错误：${task.error_message}`);
  }

  lines.push("", "失败日志：");
  if (failedMessages.length === 0) {
    lines.push("无失败日志");
  } else {
    failedMessages.forEach((message, index) => {
      lines.push(`${index + 1}. ${message}`);
    });
  }

  return lines.join("\n");
}

export function getTaskRetryAction(task: TaskRecord): TaskRetryAction {
  const isPaused = task.status === "paused";
  const labels = isPaused
    ? { idleLabel: "继续任务", pendingLabel: "继续中..." }
    : { idleLabel: "重试", pendingLabel: "重试中..." };

  const unavailable = (reason: string): TaskRetryAction => ({
    ...labels,
    canRun: false,
    unavailableReason: reason,
  });

  if (task.kind === "single_download") {
    const url = task.source_url ?? task.scan_items[0]?.url ?? "";
    if (!url) return unavailable("当前任务缺少来源链接，请重新创建任务。");
    return { ...labels, canRun: true, unavailableReason: "" };
  }

  if (task.kind === "selected_download") {
    const selected = task.retry_context?.selected_items ?? [];
    if (selected.length === 0) {
      return unavailable("当前任务缺少可继续的下载列表，请重新创建任务。");
    }
    return { ...labels, canRun: true, unavailableReason: "" };
  }

  return { ...labels, canRun: true, unavailableReason: "" };
}

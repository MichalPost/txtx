export interface BatchImportFeedbackInput {
  requestedCount: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export function formatBatchImportResult({
  requestedCount,
  successCount,
  failureCount,
  duplicateCount,
  invalidCount,
}: BatchImportFeedbackInput): string {
  if (requestedCount === 0) {
    if (duplicateCount > 0 && invalidCount > 0) {
      return `没有可创建的任务：已跳过 ${duplicateCount} 条重复链接和 ${invalidCount} 条无效内容`;
    }
    if (duplicateCount > 0) {
      return `没有可创建的任务：已跳过 ${duplicateCount} 条重复链接`;
    }
    return `没有可创建的任务：已跳过 ${invalidCount} 条无效内容`;
  }

  if (failureCount === 0 && duplicateCount === 0 && invalidCount === 0) {
    return `已创建 ${successCount} 个任务`;
  }

  const suffixParts: string[] = [];
  if (duplicateCount > 0) suffixParts.push(`${duplicateCount} 条重复链接`);
  if (invalidCount > 0) suffixParts.push(`${invalidCount} 条无效内容`);

  const suffix = suffixParts.length > 0 ? `；另有 ${suffixParts.join("、")}已跳过` : "";

  if (failureCount > 0) {
    return `已创建 ${successCount} 个任务，${failureCount} 个失败${suffix}`;
  }

  return `已创建 ${successCount} 个任务${suffix}`;
}


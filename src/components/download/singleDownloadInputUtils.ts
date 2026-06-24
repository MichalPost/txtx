const HTTP_URL_PATTERN = /^https?:\/\/.{5,}$/;

export function validateSingleDownloadUrl(url: string): string | null {
  const trimmed = url.trim();

  if (!trimmed) {
    return "先输入小说详情页 URL，再开始下载";
  }

  if (!HTTP_URL_PATTERN.test(trimmed)) {
    return "请输入以 http:// 或 https:// 开头的小说链接";
  }

  return null;
}

export function describeSingleDownloadFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("unsupported") ||
    normalized.includes("site") ||
    normalized.includes("rule") ||
    normalized.includes("规则")
  ) {
    return "创建失败，请保留当前链接检查站点规则后重试";
  }

  return "创建失败，当前链接已保留，可稍后重试或改走扫描任务";
}


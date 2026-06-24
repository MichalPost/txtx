import type { HistoryEntry } from "@/types";

const HISTORY_EXPORT_HEADERS = ["状态", "书名", "来源站点", "链接", "下载时间", "备注"] as const;

function escapeCsvCell(value: string | null | undefined): string {
  const text = value ?? "";
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildHistoryCsv(entries: HistoryEntry[]): string {
  const rows = entries.map((entry) => [
    entry.status === "success" ? "成功" : "失败",
    entry.name,
    entry.site,
    entry.url,
    entry.downloaded_at,
    entry.message ?? "",
  ]);

  return [HISTORY_EXPORT_HEADERS, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

export function buildHistoryExportFilename(date = new Date()): string {
  return `txtx-history-${date.toISOString().slice(0, 10)}.csv`;
}

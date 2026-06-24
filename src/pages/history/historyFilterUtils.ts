import type { HistoryEntry } from "@/types";

export function buildHistorySiteOptions(
  entries: HistoryEntry[],
  siteOptionsFromStats: string[],
  selectedSite: string,
) {
  const normalized = new Set<string>();

  for (const site of siteOptionsFromStats) {
    const next = site.replace(/^https?:\/\//, "").trim();
    if (next) normalized.add(next);
  }

  for (const entry of entries) {
    const next = entry.site.replace(/^https?:\/\//, "").trim();
    if (next) normalized.add(next);
  }

  if (selectedSite.trim()) {
    normalized.add(selectedSite.trim());
  }

  return Array.from(normalized).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function buildHistoryEmptyStateSummary(params: {
  activeSearch: string;
  siteFilter: string;
  statusFilter: "" | "success" | "error";
}) {
  const parts = [
    params.activeSearch ? `关键词：${params.activeSearch}` : null,
    params.statusFilter ? `状态：${params.statusFilter === "success" ? "成功" : "失败"}` : null,
    params.siteFilter ? `站点：${params.siteFilter}` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

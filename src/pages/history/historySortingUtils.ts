import type { HistoryEntry } from "@/types";

export type HistorySortField = "downloaded_at" | "name" | "site" | "status";
export type HistorySortOrder = "asc" | "desc";

export interface HistorySortState {
  sortBy: HistorySortField;
  sortOrder: HistorySortOrder;
}

const DEFAULT_HISTORY_SORT: HistorySortState = {
  sortBy: "downloaded_at",
  sortOrder: "desc",
};

export function getNextHistorySort(current: HistorySortState, field: HistorySortField): HistorySortState {
  if (current.sortBy !== field) {
    return {
      sortBy: field,
      sortOrder: field === "downloaded_at" ? "desc" : "asc",
    };
  }

  if (current.sortOrder === "asc") {
    return { sortBy: field, sortOrder: "desc" };
  }

  return DEFAULT_HISTORY_SORT;
}

export function normalizeHistorySiteOptions(siteOptions: string[]) {
  return Array.from(
    new Set(
      siteOptions
        .map((site) => site.trim().replace(/^https?:\/\//, ""))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function buildHistorySiteOptions(
  entries: HistoryEntry[],
  siteOptionsFromApi: string[],
  selectedSite: string,
) {
  return normalizeHistorySiteOptions([
    ...siteOptionsFromApi,
    ...entries.map((entry) => entry.site),
    selectedSite,
  ]);
}

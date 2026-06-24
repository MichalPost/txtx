export type HistorySortField = "downloaded_at" | "name" | "site" | "status";
export type HistorySortOrder = "asc" | "desc";

export interface HistoryQuerySort {
  page?: number;
  page_size?: number;
  search?: string;
  status?: "success" | "error" | "";
  site?: string;
  sort_by?: HistorySortField;
  sort_order?: HistorySortOrder;
}

const HISTORY_SORT_FIELDS = new Set<HistorySortField>(["downloaded_at", "name", "site", "status"]);
const HISTORY_SORT_ORDERS = new Set<HistorySortOrder>(["asc", "desc"]);

export function buildHistoryQuerySearchParams(query: HistoryQuerySort) {
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.site?.trim()) params.set("site", query.site.trim());
  if (query.sort_by && HISTORY_SORT_FIELDS.has(query.sort_by)) params.set("sort_by", query.sort_by);
  if (query.sort_order && HISTORY_SORT_ORDERS.has(query.sort_order)) {
    params.set("sort_order", query.sort_order);
  }

  return params;
}

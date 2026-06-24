import type { HistorySiteOptionsResult } from "@/lib/api";

export function getHistorySiteOptionsFromResult(result?: HistorySiteOptionsResult) {
  return result?.site_options ?? [];
}

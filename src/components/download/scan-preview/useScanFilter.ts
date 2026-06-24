import { useDeferredValue, useMemo, useState } from "react";

import type { ScanItem } from "@/types";

import { filterAndSortScanItems, type ScanSortField } from "./scanPreviewUtils";

export type FilterTab = "all" | "pending" | "excluded";

export function useScanFilter(scanItems: ScanItem[]) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("pending");
  const [sortField, setSortField] = useState<ScanSortField>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    return filterAndSortScanItems(scanItems, {
      tab,
      search: deferredSearch,
      sortField,
      sortAsc,
    });
  }, [deferredSearch, scanItems, sortAsc, sortField, tab]);

  function toggleSort(field: ScanSortField) {
    if (sortField === field) setSortAsc((v) => !v);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  return { search, setSearch, tab, setTab, sortField, sortAsc, filtered, toggleSort };
}

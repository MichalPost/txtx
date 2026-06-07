import { useMemo, useState } from "react";

import type { ScanItem } from "@/types";

export type FilterTab = "all" | "pending" | "excluded";

export function useScanFilter(scanItems: ScanItem[]) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("pending");
  const [sortField, setSortField] = useState<"name" | "site" | "date">("date");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let list = scanItems;
    if (tab === "pending") list = list.filter((i) => !i.excluded_reason);
    if (tab === "excluded") list = list.filter((i) => !!i.excluded_reason);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.site.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const va = a[sortField] ?? "";
      const vb = b[sortField] ?? "";
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [scanItems, tab, search, sortField, sortAsc]);

  function toggleSort(field: "name" | "site" | "date") {
    if (sortField === field) setSortAsc((v) => !v);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  return { search, setSearch, tab, setTab, sortField, sortAsc, filtered, toggleSort };
}

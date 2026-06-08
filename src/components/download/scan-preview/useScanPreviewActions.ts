import { useMemo } from "react";

import type { ScanItem } from "@/types";

export function useScanPreviewActions({
  scanItems,
  selectedUrls,
  toggleSelect,
  onSiteFilterClose,
}: {
  scanItems: ScanItem[];
  selectedUrls: Set<string>;
  toggleSelect: (url: string) => void;
  onSiteFilterClose: () => void;
}) {
  const pendingCount = scanItems.filter((i) => !i.excluded_reason).length;
  const excludedCount = scanItems.filter((i) => !!i.excluded_reason).length;
  const selectedCount = selectedUrls.size;
  const sites = useMemo(() => [...new Set(scanItems.map((i) => i.site))], [scanItems]);
  const allPendingSelected = pendingCount > 0 && pendingCount === selectedCount;
  const blacklistCount = scanItems.filter((i) => i.excluded_reason?.startsWith("黑名单")).length;
  const localCount = scanItems.filter((i) => i.excluded_reason === "本地已存在").length;

  function forceAdd(item: ScanItem) {
    if (!selectedUrls.has(item.url)) toggleSelect(item.url);
  }

  function selectBySite(site: string) {
    const urls = scanItems.filter((i) => i.site === site && !i.excluded_reason).map((i) => i.url);
    urls.forEach((u) => {
      if (!selectedUrls.has(u)) toggleSelect(u);
    });
    onSiteFilterClose();
  }

  function forceAddAllBlacklisted() {
    scanItems
      .filter((i) => i.excluded_reason?.startsWith("黑名单"))
      .forEach((i) => {
        if (!selectedUrls.has(i.url)) toggleSelect(i.url);
      });
  }

  function forceAddAllLocal() {
    scanItems
      .filter((i) => i.excluded_reason === "本地已存在")
      .forEach((i) => {
        if (!selectedUrls.has(i.url)) toggleSelect(i.url);
      });
  }

  return {
    pendingCount,
    excludedCount,
    selectedCount,
    sites,
    allPendingSelected,
    blacklistCount,
    localCount,
    forceAdd,
    selectBySite,
    forceAddAllBlacklisted,
    forceAddAllLocal,
  };
}

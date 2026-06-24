import { useCallback, useMemo } from "react";

import type { ScanItem } from "@/types";

import { buildScanPreviewSummary } from "./scanPreviewUtils";

export function useScanPreviewActions({
  scanItems,
  selectedUrls,
  toggleSelect,
  selectUrls,
  onSiteFilterClose,
}: {
  scanItems: ScanItem[];
  selectedUrls: Set<string>;
  toggleSelect: (url: string) => void;
  selectUrls: (urls: Iterable<string>, value: boolean) => void;
  onSiteFilterClose: () => void;
}) {
  const summary = useMemo(
    () => buildScanPreviewSummary(scanItems, selectedUrls),
    [scanItems, selectedUrls],
  );

  const forceAdd = useCallback((item: ScanItem) => {
    if (!selectedUrls.has(item.url)) toggleSelect(item.url);
  }, [selectedUrls, toggleSelect]);

  const selectBySite = useCallback((site: string) => {
    const pendingUrls = summary.sites.find((entry) => entry.site === site)?.pendingUrls ?? [];
    selectUrls(pendingUrls, true);
    onSiteFilterClose();
  }, [onSiteFilterClose, selectUrls, summary.sites]);

  const forceAddAllBlacklisted = useCallback(() => {
    selectUrls(summary.blacklistedUrls, true);
  }, [selectUrls, summary.blacklistedUrls]);

  const forceAddAllLocal = useCallback(() => {
    selectUrls(summary.localUrls, true);
  }, [selectUrls, summary.localUrls]);

  return {
    pendingCount: summary.pendingCount,
    excludedCount: summary.excludedCount,
    selectedCount: summary.selectedCount,
    siteSummaries: summary.sites,
    allPendingSelected: summary.allPendingSelected,
    blacklistCount: summary.blacklistCount,
    localCount: summary.localCount,
    forceAdd,
    selectBySite,
    forceAddAllBlacklisted,
    forceAddAllLocal,
  };
}

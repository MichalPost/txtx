import { useCallback, useMemo } from "react";

import type { ScanItem } from "@/types";

import { buildScanPreviewSummary } from "./scanPreviewUtils";

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
  const summary = useMemo(
    () => buildScanPreviewSummary(scanItems, selectedUrls),
    [scanItems, selectedUrls],
  );

  const forceAdd = useCallback((item: ScanItem) => {
    if (!selectedUrls.has(item.url)) toggleSelect(item.url);
  }, [selectedUrls, toggleSelect]);

  const selectBySite = useCallback((site: string) => {
    const pendingUrls = summary.sites.find((entry) => entry.site === site)?.pendingUrls ?? [];
    pendingUrls.forEach((u) => {
      if (!selectedUrls.has(u)) toggleSelect(u);
    });
    onSiteFilterClose();
  }, [onSiteFilterClose, selectedUrls, summary.sites, toggleSelect]);

  const forceAddAllBlacklisted = useCallback(() => {
    summary.blacklistedUrls.forEach((url) => {
      if (!selectedUrls.has(url)) toggleSelect(url);
    });
  }, [selectedUrls, summary.blacklistedUrls, toggleSelect]);

  const forceAddAllLocal = useCallback(() => {
    summary.localUrls.forEach((url) => {
      if (!selectedUrls.has(url)) toggleSelect(url);
    });
  }, [selectedUrls, summary.localUrls, toggleSelect]);

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

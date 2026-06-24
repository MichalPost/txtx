import type { ScanItem } from "@/types";

import type { FilterTab } from "./useScanFilter";

export type ScanSortField = "name" | "site" | "date";

export interface ScanSiteSummary {
  site: string;
  label: string;
  pendingCount: number;
  pendingUrls: string[];
}

export interface ScanPreviewSummary {
  pendingCount: number;
  excludedCount: number;
  selectedCount: number;
  allPendingSelected: boolean;
  blacklistCount: number;
  localCount: number;
  blacklistedUrls: string[];
  localUrls: string[];
  sites: ScanSiteSummary[];
}

export interface GroupedScanItems {
  site: string;
  label: string;
  items: ScanItem[];
  pendingCount: number;
  excludedCount: number;
  pendingUrls: string[];
  selectedPendingCount: number;
  allPendingSelected: boolean;
}

export interface ScanSelectionBatch {
  urls: Iterable<string>;
  selected: boolean;
}

export interface VisibleGroupedScanItems {
  visibleItems: ScanItem[];
  hiddenCount: number;
  canExpand: boolean;
}

function getSiteLabel(site: string) {
  return site.replace(/^https?:\/\//, "");
}

export function filterAndSortScanItems(
  scanItems: ScanItem[],
  {
    tab,
    search,
    sortField,
    sortAsc,
  }: {
    tab: FilterTab;
    search: string;
    sortField: ScanSortField;
    sortAsc: boolean;
  },
) {
  const normalizedSearch = search.trim().toLowerCase();

  let list = scanItems;
  if (tab === "pending") list = list.filter((item) => !item.excluded_reason);
  if (tab === "excluded") list = list.filter((item) => !!item.excluded_reason);

  if (normalizedSearch) {
    list = list.filter((item) => {
      const name = item.name.toLowerCase();
      const site = item.site.toLowerCase();
      return name.includes(normalizedSearch) || site.includes(normalizedSearch);
    });
  }

  return [...list].sort((left, right) => {
    const leftValue = left[sortField] ?? "";
    const rightValue = right[sortField] ?? "";
    return sortAsc
      ? leftValue.localeCompare(rightValue)
      : rightValue.localeCompare(leftValue);
  });
}

export function buildScanPreviewSummary(
  scanItems: ScanItem[],
  selectedUrls: Set<string>,
): ScanPreviewSummary {
  let pendingCount = 0;
  let excludedCount = 0;
  let blacklistCount = 0;
  let localCount = 0;

  const blacklistedUrls: string[] = [];
  const localUrls: string[] = [];
  const siteMap = new Map<string, ScanSiteSummary>();

  for (const item of scanItems) {
    let siteSummary = siteMap.get(item.site);
    if (!siteSummary) {
      siteSummary = {
        site: item.site,
        label: getSiteLabel(item.site),
        pendingCount: 0,
        pendingUrls: [],
      };
      siteMap.set(item.site, siteSummary);
    }

    if (item.excluded_reason) {
      excludedCount += 1;
      if (item.excluded_reason.startsWith("黑名单")) {
        blacklistCount += 1;
        blacklistedUrls.push(item.url);
      }
      if (item.excluded_reason === "本地已存在") {
        localCount += 1;
        localUrls.push(item.url);
      }
      continue;
    }

    pendingCount += 1;
    siteSummary.pendingCount += 1;
    siteSummary.pendingUrls.push(item.url);
  }

  const selectedCount = selectedUrls.size;
  const sites = [...siteMap.values()].sort((left, right) => right.pendingCount - left.pendingCount);

  return {
    pendingCount,
    excludedCount,
    selectedCount,
    allPendingSelected: pendingCount > 0 && pendingCount === selectedCount,
    blacklistCount,
    localCount,
    blacklistedUrls,
    localUrls,
    sites,
  };
}

export function groupScanItemsBySite(items: ScanItem[], selectedUrls: Set<string>): GroupedScanItems[] {
  const groups = new Map<string, GroupedScanItems>();

  for (const item of items) {
    let group = groups.get(item.site);
    if (!group) {
      group = {
        site: item.site,
        label: getSiteLabel(item.site),
        items: [],
        pendingCount: 0,
        excludedCount: 0,
        pendingUrls: [],
        selectedPendingCount: 0,
        allPendingSelected: false,
      };
      groups.set(item.site, group);
    }

    group.items.push(item);

    if (item.excluded_reason) {
      group.excludedCount += 1;
      continue;
    }

    group.pendingCount += 1;
    group.pendingUrls.push(item.url);
    if (selectedUrls.has(item.url)) {
      group.selectedPendingCount += 1;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      allPendingSelected:
        group.pendingCount > 0 && group.selectedPendingCount === group.pendingCount,
    }))
    .sort((left, right) => right.items.length - left.items.length);
}

export function applyScanSelectionBatch(
  selectedUrls: Set<string>,
  { urls, selected }: ScanSelectionBatch,
): Set<string> {
  const next = new Set(selectedUrls);
  for (const url of urls) {
    if (selected) {
      next.add(url);
    } else {
      next.delete(url);
    }
  }
  return next;
}

export function getVisibleGroupedScanItems(
  items: ScanItem[],
  { expanded, limit }: { expanded: boolean; limit: number },
): VisibleGroupedScanItems {
  const normalizedLimit = Math.max(1, Math.floor(limit));
  if (expanded || items.length <= normalizedLimit) {
    return {
      visibleItems: items,
      hiddenCount: 0,
      canExpand: false,
    };
  }

  return {
    visibleItems: items.slice(0, normalizedLimit),
    hiddenCount: items.length - normalizedLimit,
    canExpand: true,
  };
}

import type { HistoryEntry } from "@/types";

export function getHistoryEntryKey(entry: HistoryEntry): string {
  return `${entry.url}::${entry.downloaded_at}`;
}

export function isRetryableHistoryEntry(entry: HistoryEntry): boolean {
  return entry.status === "error" && entry.url.trim().length > 0;
}

export function getRetryableHistoryKeys(entries: HistoryEntry[]): string[] {
  return entries.filter(isRetryableHistoryEntry).map(getHistoryEntryKey);
}

export function reconcileHistorySelection(
  selectedKeys: Set<string>,
  visibleEntries: HistoryEntry[],
): Set<string> {
  const visibleKeys = new Set(visibleEntries.map(getHistoryEntryKey));
  return new Set([...selectedKeys].filter((key) => visibleKeys.has(key)));
}

export function toggleHistorySelection(
  selectedKeys: Set<string>,
  key: string,
  checked?: boolean,
): Set<string> {
  const next = new Set(selectedKeys);
  const shouldSelect = checked ?? !next.has(key);
  if (shouldSelect) {
    next.add(key);
  } else {
    next.delete(key);
  }
  return next;
}

export function setHistorySelectionForKeys(keys: string[], checked: boolean): Set<string> {
  return checked ? new Set(keys) : new Set();
}

export function buildHistorySelectionSummary(
  selectedKeys: Set<string>,
  entries: HistoryEntry[],
): {
  retryableCount: number;
  selectedRetryableCount: number;
  allRetryableSelected: boolean;
  selectedEntries: HistoryEntry[];
} {
  const retryableEntries = entries.filter(isRetryableHistoryEntry);
  const selectedEntries = retryableEntries.filter((entry) =>
    selectedKeys.has(getHistoryEntryKey(entry)),
  );

  return {
    retryableCount: retryableEntries.length,
    selectedRetryableCount: selectedEntries.length,
    allRetryableSelected:
      retryableEntries.length > 0 && selectedEntries.length === retryableEntries.length,
    selectedEntries,
  };
}

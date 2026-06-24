import assert from "node:assert/strict";
import test from "node:test";

import type { HistoryEntry } from "@/types";

import {
  buildHistorySelectionSummary,
  getHistoryEntryKey,
  getRetryableHistoryKeys,
  reconcileHistorySelection,
  setHistorySelectionForKeys,
  toggleHistorySelection,
} from "./historySelectionUtils.ts";

const entries: HistoryEntry[] = [
  {
    name: "失败 A",
    url: "https://example.com/a",
    site: "example.com",
    downloaded_at: "2026-06-24 10:00",
    status: "error",
    message: "timeout",
  },
  {
    name: "成功 B",
    url: "https://example.com/b",
    site: "example.com",
    downloaded_at: "2026-06-24 10:01",
    status: "success",
    message: null,
  },
  {
    name: "失败 C",
    url: "https://example.com/c",
    site: "example.com",
    downloaded_at: "2026-06-24 10:02",
    status: "error",
    message: "network",
  },
];

test("getRetryableHistoryKeys returns only failed entries with urls", () => {
  assert.deepEqual(getRetryableHistoryKeys(entries), [
    getHistoryEntryKey(entries[0]),
    getHistoryEntryKey(entries[2]),
  ]);
});

test("toggleHistorySelection adds and removes keys immutably", () => {
  const first = toggleHistorySelection(new Set<string>(), "a");
  const second = toggleHistorySelection(first, "a");

  assert.deepEqual([...first], ["a"]);
  assert.deepEqual([...second], []);
});

test("reconcileHistorySelection keeps only visible entries", () => {
  const selected = new Set([getHistoryEntryKey(entries[0]), "stale"]);

  assert.deepEqual([...reconcileHistorySelection(selected, entries)], [getHistoryEntryKey(entries[0])]);
});

test("buildHistorySelectionSummary reports retryable selected state", () => {
  const keys = getRetryableHistoryKeys(entries);
  const summary = buildHistorySelectionSummary(setHistorySelectionForKeys(keys, true), entries);

  assert.equal(summary.retryableCount, 2);
  assert.equal(summary.selectedRetryableCount, 2);
  assert.equal(summary.allRetryableSelected, true);
  assert.deepEqual(summary.selectedEntries.map((entry) => entry.name), ["失败 A", "失败 C"]);
});

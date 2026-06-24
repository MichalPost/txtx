import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScanPreviewSummary,
  filterAndSortScanItems,
  groupScanItemsBySite,
} from "./scanPreviewUtils.ts";

const scanItems = [
  {
    url: "https://a.example/book-1",
    name: "Alpha",
    site: "https://a.example",
    date: "2026-06-20",
    excluded_reason: undefined,
  },
  {
    url: "https://a.example/book-2",
    name: "Beta",
    site: "https://a.example",
    date: "2026-06-18",
    excluded_reason: "黑名单: 作者",
  },
  {
    url: "https://b.example/book-3",
    name: "Gamma",
    site: "https://b.example",
    date: "2026-06-19",
    excluded_reason: "本地已存在",
  },
  {
    url: "https://b.example/book-4",
    name: "Delta",
    site: "https://b.example",
    date: "2026-06-21",
    excluded_reason: undefined,
  },
];

test("buildScanPreviewSummary aggregates counts and site options in one pass", () => {
  const selectedUrls = new Set(["https://a.example/book-1", "https://b.example/book-3"]);
  const summary = buildScanPreviewSummary(scanItems, selectedUrls);

  assert.equal(summary.pendingCount, 2);
  assert.equal(summary.excludedCount, 2);
  assert.equal(summary.selectedCount, 2);
  assert.equal(summary.allPendingSelected, true);
  assert.equal(summary.blacklistCount, 1);
  assert.equal(summary.localCount, 1);
  assert.deepEqual(summary.blacklistedUrls, ["https://a.example/book-2"]);
  assert.deepEqual(summary.localUrls, ["https://b.example/book-3"]);
  assert.deepEqual(
    summary.sites.map((site) => ({ label: site.label, pendingCount: site.pendingCount })),
    [
      { label: "a.example", pendingCount: 1 },
      { label: "b.example", pendingCount: 1 },
    ],
  );
});

test("filterAndSortScanItems applies tab, search, and sort without mutating input", () => {
  const filtered = filterAndSortScanItems(scanItems, {
    tab: "all",
    search: "example",
    sortField: "date",
    sortAsc: false,
  });

  assert.deepEqual(
    filtered.map((item) => item.url),
    [
      "https://b.example/book-4",
      "https://a.example/book-1",
      "https://b.example/book-3",
      "https://a.example/book-2",
    ],
  );
  assert.equal(scanItems[0].url, "https://a.example/book-1");
});

test("groupScanItemsBySite keeps pending selection counts for grouped tables", () => {
  const groups = groupScanItemsBySite(scanItems, new Set(["https://b.example/book-4"]));

  assert.deepEqual(
    groups.map((group) => ({
      label: group.label,
      pendingCount: group.pendingCount,
      excludedCount: group.excludedCount,
      selectedPendingCount: group.selectedPendingCount,
      allPendingSelected: group.allPendingSelected,
    })),
    [
      {
        label: "a.example",
        pendingCount: 1,
        excludedCount: 1,
        selectedPendingCount: 0,
        allPendingSelected: false,
      },
      {
        label: "b.example",
        pendingCount: 1,
        excludedCount: 1,
        selectedPendingCount: 1,
        allPendingSelected: true,
      },
    ],
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVisiblePages,
  clampHistoryPageForTotal,
  normalizeHistoryPageState,
} from "./historyPaginationUtils.ts";

test("buildVisiblePages centers around current page", () => {
  assert.deepEqual(buildVisiblePages(5, 10, 5), [3, 4, 5, 6, 7]);
});

test("buildVisiblePages clamps near the beginning", () => {
  assert.deepEqual(buildVisiblePages(1, 10, 5), [1, 2, 3, 4, 5]);
});

test("buildVisiblePages clamps near the end", () => {
  assert.deepEqual(buildVisiblePages(10, 10, 5), [6, 7, 8, 9, 10]);
});

test("buildVisiblePages returns all pages when total is small", () => {
  assert.deepEqual(buildVisiblePages(2, 3, 5), [1, 2, 3]);
});

test("normalizeHistoryPageState clamps page and unsupported page sizes", () => {
  assert.deepEqual(normalizeHistoryPageState({ page: 0, pageSize: 75 }), {
    page: 1,
    pageSize: 50,
  });
  assert.deepEqual(normalizeHistoryPageState({ page: 3.8, pageSize: 200 }), {
    page: 3,
    pageSize: 200,
  });
});

test("clampHistoryPageForTotal keeps current page within available result pages", () => {
  assert.equal(clampHistoryPageForTotal({ page: 8, pageSize: 50, total: 126 }), 3);
  assert.equal(clampHistoryPageForTotal({ page: 2, pageSize: 50, total: 0 }), 1);
  assert.equal(clampHistoryPageForTotal({ page: 2, pageSize: 50, total: 126 }), 2);
});

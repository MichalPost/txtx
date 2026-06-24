import assert from "node:assert/strict";
import test from "node:test";

import { buildVisiblePages } from "./historyPaginationUtils.ts";

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

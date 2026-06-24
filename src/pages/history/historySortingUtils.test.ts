import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHistorySiteOptions,
  getNextHistorySort,
  normalizeHistorySiteOptions,
} from "./historySortingUtils.ts";

test("getNextHistorySort toggles asc, desc, and default state for the active field", () => {
  assert.deepEqual(getNextHistorySort({ sortBy: "downloaded_at", sortOrder: "desc" }, "name"), {
    sortBy: "name",
    sortOrder: "asc",
  });
  assert.deepEqual(getNextHistorySort({ sortBy: "name", sortOrder: "asc" }, "name"), {
    sortBy: "name",
    sortOrder: "desc",
  });
  assert.deepEqual(getNextHistorySort({ sortBy: "name", sortOrder: "desc" }, "name"), {
    sortBy: "downloaded_at",
    sortOrder: "desc",
  });
});

test("normalizeHistorySiteOptions trims protocol, de-duplicates, and sorts", () => {
  assert.deepEqual(
    normalizeHistorySiteOptions(["https://a.example", "b.example", "  http://a.example ", ""]),
    ["a.example", "b.example"],
  );
});

test("buildHistorySiteOptions merges api options, current page, and selected site without duplicates", () => {
  const options = buildHistorySiteOptions(
    [
      {
        name: "A",
        url: "https://a.example/book",
        site: "https://a.example",
        downloaded_at: "2025-01-01 00:00:00",
        status: "success",
        message: null,
      },
    ],
    ["b.example", "https://a.example", "c.example"],
    "d.example",
  );

  assert.deepEqual(options, ["a.example", "b.example", "c.example", "d.example"]);
});

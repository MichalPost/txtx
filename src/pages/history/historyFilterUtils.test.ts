import assert from "node:assert/strict";
import test from "node:test";

import { buildHistoryEmptyStateSummary, buildHistorySiteOptions } from "./historyFilterUtils.ts";

test("buildHistorySiteOptions merges stats, current page, and selected site without duplicates", () => {
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

test("buildHistoryEmptyStateSummary formats active filter labels", () => {
  assert.equal(
    buildHistoryEmptyStateSummary({
      activeSearch: "修仙",
      siteFilter: "a.example",
      statusFilter: "error",
    }),
    "关键词：修仙 · 状态：失败 · 站点：a.example",
  );
});

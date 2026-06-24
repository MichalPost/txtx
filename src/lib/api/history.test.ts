import assert from "node:assert/strict";
import test from "node:test";

import { apiClearHistory } from "./history.ts";
import { buildHistoryQuerySearchParams, type HistoryQuerySort } from "./historyQueryParams.ts";

test("buildHistoryQuerySearchParams includes supported sort fields and directions", () => {
  const params = buildHistoryQuerySearchParams({
    page: 2,
    page_size: 100,
    search: "修仙",
    status: "success",
    site: "a.example",
    sort_by: "name",
    sort_order: "asc",
  });

  assert.equal(
    params.toString(),
    "page=2&page_size=100&search=%E4%BF%AE%E4%BB%99&status=success&site=a.example&sort_by=name&sort_order=asc",
  );
});

test("buildHistoryQuerySearchParams omits empty filters and unsupported sort options", () => {
  const params = buildHistoryQuerySearchParams({
    page: 1,
    search: "",
    status: "",
    site: " ",
    sort_by: "message" as HistoryQuerySort["sort_by"],
    sort_order: "sideways" as HistoryQuerySort["sort_order"],
  });

  assert.equal(params.toString(), "page=1");
});

test("apiClearHistory throws when web request fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("clear failed", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });

  await assert.rejects(() => apiClearHistory(), /clear failed/);

  globalThis.fetch = originalFetch;
});

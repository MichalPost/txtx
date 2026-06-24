import assert from "node:assert/strict";
import test from "node:test";

import { getHistorySiteOptionsFromResult } from "./historySiteOptionsUtils.ts";

test("getHistorySiteOptionsFromResult falls back to an empty array", () => {
  assert.deepEqual(getHistorySiteOptionsFromResult(undefined), []);
});

test("getHistorySiteOptionsFromResult returns site options from query result", () => {
  assert.deepEqual(getHistorySiteOptionsFromResult({ site_options: ["a.example", "b.example"] }), [
    "a.example",
    "b.example",
  ]);
});

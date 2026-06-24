import assert from "node:assert/strict";
import test from "node:test";

import { countFilledPaths, summarizeConvertResults } from "./converterUtils.ts";

test("countFilledPaths ignores empty and whitespace-only paths", () => {
  assert.equal(countFilledPaths(["", "  ", "D:/a.txt", "C:/b.txt"]), 2);
});

test("summarizeConvertResults counts success and failures", () => {
  assert.deepEqual(
    summarizeConvertResults([
      { path: "a.txt", message: "ok", ok: true },
      { path: "b.txt", message: "bad", ok: false },
      { path: "c.txt", message: "ok", ok: true },
    ]),
    { total: 3, success: 2, failed: 1 },
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  countFilledPaths,
  getRegexValidationError,
  parsePathImportDraft,
  summarizeConvertResults,
} from "./converterUtils.ts";

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

test("parsePathImportDraft accepts unique paths while tracking empty and duplicate items", () => {
  const result = parsePathImportDraft(
    `
      "D:/books/a.txt";
      D:/books/b.txt
      d:/BOOKS/a.txt

      C:/novels/c.txt
    `,
    ["D:/books/existing.txt", "c:/NOVELS/c.txt"],
  );

  assert.deepEqual(result, {
    accepted: ["D:/books/a.txt", "D:/books/b.txt"],
    duplicateCount: 2,
    emptyCount: 2,
  });
});

test("getRegexValidationError validates optional split patterns", () => {
  assert.equal(getRegexValidationError(""), null);
  assert.equal(getRegexValidationError("^第.+章"), null);
  assert.match(getRegexValidationError("(") ?? "", /Invalid regular expression/);
});

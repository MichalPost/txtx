import assert from "node:assert/strict";
import test from "node:test";

import { summarizeImportedUrls } from "./importUrlPanelUtils.ts";

test("summarizeImportedUrls deduplicates valid urls while tracking invalid and duplicate entries", () => {
  const summary = summarizeImportedUrls([
    "https://example.com/book-1",
    " https://example.com/book-1 ",
    "not-a-url",
    "",
    "https://example.com/book-2",
    "https://example.com/book-2",
    "ftp://example.com/book-3",
  ].join("\n"));

  assert.deepEqual(summary.urls, [
    "https://example.com/book-1",
    "https://example.com/book-2",
  ]);
  assert.equal(summary.validCount, 2);
  assert.equal(summary.duplicateCount, 2);
  assert.equal(summary.invalidCount, 2);
  assert.deepEqual(summary.invalidSamples, ["not-a-url", "ftp://example.com/book-3"]);
  assert.equal(summary.normalizedText, "https://example.com/book-1\nhttps://example.com/book-2");
});

test("summarizeImportedUrls splits csv-style separators and preserves first-seen order", () => {
  const summary = summarizeImportedUrls(
    "https://example.com/a, https://example.com/b;\nhttps://example.com/a\r\nhttps://example.com/c",
  );

  assert.deepEqual(summary.urls, [
    "https://example.com/a",
    "https://example.com/b",
    "https://example.com/c",
  ]);
  assert.equal(summary.duplicateCount, 1);
  assert.equal(summary.invalidCount, 0);
  assert.deepEqual(summary.invalidSamples, []);
  assert.equal(
    summary.normalizedText,
    "https://example.com/a\nhttps://example.com/b\nhttps://example.com/c",
  );
});

test("summarizeImportedUrls limits invalid samples while counting all invalid entries", () => {
  const summary = summarizeImportedUrls(
    ["bad-1", "bad-2", "bad-3", "bad-4", "https://example.com/a"].join("\n"),
  );

  assert.deepEqual(summary.invalidSamples, ["bad-1", "bad-2", "bad-3"]);
  assert.equal(summary.invalidCount, 4);
  assert.deepEqual(summary.urls, ["https://example.com/a"]);
});

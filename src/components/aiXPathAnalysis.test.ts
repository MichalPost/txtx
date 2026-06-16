import assert from "node:assert/strict";
import test from "node:test";

import { parseAiXPathAnalysis } from "./aiXPathAnalysis.ts";

test("parseAiXPathAnalysis ignores malformed batch fields", () => {
  const results = parseAiXPathAnalysis(
    {
      list_novel_name: { xpath: "//h1/text()", explanation: "ok" },
      release_url: { xpath: 42 },
    },
    null,
  );

  assert.equal(results.find((item) => item.key === "list_novel_name")?.suggested, "//h1/text()");
  assert.equal(results.find((item) => item.key === "release_url")?.suggested, "");
});

test("parseAiXPathAnalysis normalizes non-string extract results", () => {
  const results = parseAiXPathAnalysis({}, { release_date: 123, novel_content: "//div/text()" });

  assert.equal(results.find((item) => item.key === "release_date")?.suggested, "");
  assert.equal(results.find((item) => item.key === "novel_content")?.suggested, "//div/text()");
});

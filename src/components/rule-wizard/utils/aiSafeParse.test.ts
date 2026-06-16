import assert from "node:assert/strict";
import test from "node:test";

import { readAiFieldMap, readAiXPathReply } from "./aiSafeParse.ts";

test("readAiXPathReply normalizes malformed values", () => {
  assert.deepEqual(readAiXPathReply({ xpath: 123, explanation: null, alternatives: ["a", 1] }), {
    xpath: "",
    explanation: "",
    alternatives: ["a"],
  });
});

test("readAiFieldMap normalizes nested field maps", () => {
  assert.deepEqual(
    readAiFieldMap({
      list_novel_name: { xpath: "//h1/text()", explanation: "ok" },
      release_url: { xpath: 3 },
    }),
    {
      list_novel_name: { xpath: "//h1/text()", explanation: "ok" },
      release_url: { xpath: "", explanation: "" },
    },
  );
});

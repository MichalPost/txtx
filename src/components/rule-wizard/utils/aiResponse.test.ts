import assert from "node:assert/strict";
import test from "node:test";

import { getAiFieldResult, getAiObject, getAiString } from "./aiResponse.ts";

test("getAiObject falls back to empty object for non-objects", () => {
  assert.deepEqual(getAiObject(null), {});
  assert.deepEqual(getAiObject("bad"), {});
});

test("getAiFieldResult extracts only string xpath fields", () => {
  assert.deepEqual(getAiFieldResult({ xpath: "//div/text()", explanation: "ok" }), {
    xpath: "//div/text()",
    explanation: "ok",
  });
  assert.equal(getAiFieldResult({ xpath: 42 }), undefined);
});

test("getAiString normalizes non-string values to empty string", () => {
  assert.equal(getAiString("//a/@href"), "//a/@href");
  assert.equal(getAiString(123), "");
});

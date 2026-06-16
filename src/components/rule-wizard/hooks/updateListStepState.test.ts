import assert from "node:assert/strict";
import test from "node:test";

function getInitialFetchStatus(updateListHtml: string): "idle" | "ok" {
  return updateListHtml ? "ok" : "idle";
}

test("getInitialFetchStatus returns ok when cached html exists", () => {
  assert.equal(getInitialFetchStatus("<html></html>"), "ok");
});

test("getInitialFetchStatus returns idle when cached html is empty", () => {
  assert.equal(getInitialFetchStatus(""), "idle");
});

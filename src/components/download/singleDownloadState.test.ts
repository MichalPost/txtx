import test from "node:test";
import assert from "node:assert/strict";

import { submitSingleDownloadUrl } from "./singleDownloadState.ts";

test("submitSingleDownloadUrl only clears input after submit succeeds", async () => {
  const effects: string[] = [];

  await submitSingleDownloadUrl({
    url: "https://example.com/book",
    saveHistory: (url) => {
      effects.push(`history:${url}`);
    },
    submit: async () => {
      effects.push("submit");
    },
    clearInput: () => {
      effects.push("clear");
    },
  });

  assert.deepEqual(effects, ["submit", "history:https://example.com/book", "clear"]);

  const failedEffects: string[] = [];
  await assert.rejects(
    () =>
      submitSingleDownloadUrl({
        url: "https://example.com/book",
        saveHistory: (url) => {
          failedEffects.push(`history:${url}`);
        },
        submit: async () => {
          throw new Error("submit failed");
        },
        clearInput: () => {
          failedEffects.push("clear");
        },
      }),
    /submit failed/,
  );

  assert.deepEqual(failedEffects, []);
});

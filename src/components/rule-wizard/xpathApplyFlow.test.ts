import test from "node:test";
import assert from "node:assert/strict";

import { applyXPathResultsAndClose } from "./xpathApplyFlow.ts";

test("applyXPathResultsAndClose closes only after apply succeeds", async () => {
  const effects: string[] = [];

  await applyXPathResultsAndClose(
    async () => {
      effects.push("apply");
    },
    () => {
      effects.push("close");
    },
  );

  assert.deepEqual(effects, ["apply", "close"]);

  const failedEffects: string[] = [];
  await assert.rejects(
    () =>
      applyXPathResultsAndClose(
        async () => {
          failedEffects.push("apply");
          throw new Error("apply failed");
        },
        () => {
          failedEffects.push("close");
        },
      ),
    /apply failed/,
  );

  assert.deepEqual(failedEffects, ["apply"]);
});

import test from "node:test";
import assert from "node:assert/strict";

import { saveRuleConfigAndThen } from "./ruleSaveFlow.ts";

test("saveRuleConfigAndThen runs UI side effects only after save succeeds", async () => {
  const effects: string[] = [];

  await saveRuleConfigAndThen(
    async () => {
      effects.push("save");
    },
    () => {
      effects.push("after");
    },
  );

  assert.deepEqual(effects, ["save", "after"]);

  const failedEffects: string[] = [];
  await assert.rejects(
    () =>
      saveRuleConfigAndThen(
        async () => {
          failedEffects.push("save");
          throw new Error("save failed");
        },
        () => {
          failedEffects.push("after");
        },
      ),
    /save failed/,
  );

  assert.deepEqual(failedEffects, ["save"]);
});

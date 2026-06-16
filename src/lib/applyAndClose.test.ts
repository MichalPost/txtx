import assert from "node:assert/strict";
import test from "node:test";

import { applyAndClose } from "./applyAndClose.ts";

test("applyAndClose closes only after apply succeeds", async () => {
  const effects: string[] = [];

  await applyAndClose(
    async () => {
      effects.push("apply");
    },
    () => {
      effects.push("close");
    },
  );

  assert.deepEqual(effects, ["apply", "close"]);
});

test("applyAndClose does not close when apply fails", async () => {
  const effects: string[] = [];

  await assert.rejects(
    () =>
      applyAndClose(
        async () => {
          effects.push("apply");
          throw new Error("apply failed");
        },
        () => {
          effects.push("close");
        },
      ),
    /apply failed/,
  );

  assert.deepEqual(effects, ["apply"]);
});

import test from "node:test";
import assert from "node:assert/strict";

import { canContinueWithPreflight } from "./preflightDecision.ts";

test("canContinueWithPreflight blocks continuation when a fetch error occurred", () => {
  assert.equal(
    canContinueWithPreflight({
      done: true,
      error: "network failed",
    }),
    false,
  );
});

test("canContinueWithPreflight allows continuation when check completed without error", () => {
  assert.equal(
    canContinueWithPreflight({
      done: true,
      error: "",
    }),
    true,
  );
});

test("canContinueWithPreflight blocks while check is still running", () => {
  assert.equal(
    canContinueWithPreflight({
      done: false,
      error: "",
    }),
    false,
  );
});

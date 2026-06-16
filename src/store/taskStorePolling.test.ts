import assert from "node:assert/strict";
import test from "node:test";

import { applyTaskPollFailure, applyTaskPollSuccess } from "./taskPollingState.ts";

test("applyPollFailureState increments version only for a new poll error", () => {
  const initial = { pollError: null, pollErrorVersion: 0 };
  const firstFailure = applyTaskPollFailure(initial, new Error("network down"));
  const sameFailure = applyTaskPollFailure(firstFailure, new Error("network down"));
  const secondFailure = applyTaskPollFailure(firstFailure, new Error("timeout"));

  assert.deepEqual(firstFailure, { pollError: "network down", pollErrorVersion: 1 });
  assert.equal(sameFailure, firstFailure);
  assert.deepEqual(secondFailure, { pollError: "timeout", pollErrorVersion: 2 });
});

test("applyPollSuccessState clears stored poll error without changing version", () => {
  const failed = { pollError: "network down", pollErrorVersion: 2 };
  const healthy = { pollError: null, pollErrorVersion: 2 };

  assert.deepEqual(applyTaskPollSuccess(failed), {
    pollError: null,
    pollErrorVersion: 2,
  });
  assert.equal(applyTaskPollSuccess(healthy), healthy);
});

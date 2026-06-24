import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTaskPollFailure,
  applyTaskPollSuccess,
  getTaskPollDelayMs,
  getTaskPollScheduleDelayMs,
} from "./taskPollingState.ts";

const healthyPollState = {
  pollError: null,
  pollErrorVersion: 0,
  pollFailureCount: 0,
  nextPollDelayMs: 2000,
  lastRecoveredAt: null,
};

test("applyPollFailureState increments failure count while version changes only for a new error", () => {
  const firstFailure = applyTaskPollFailure(healthyPollState, new Error("network down"));
  const sameFailure = applyTaskPollFailure(firstFailure, new Error("network down"));
  const secondFailure = applyTaskPollFailure(firstFailure, new Error("timeout"));

  assert.deepEqual(firstFailure, {
    pollError: "network down",
    pollErrorVersion: 1,
    pollFailureCount: 1,
    nextPollDelayMs: 2000,
    lastRecoveredAt: null,
  });
  assert.deepEqual(sameFailure, {
    pollError: "network down",
    pollErrorVersion: 1,
    pollFailureCount: 2,
    nextPollDelayMs: 5000,
    lastRecoveredAt: null,
  });
  assert.deepEqual(secondFailure, {
    pollError: "timeout",
    pollErrorVersion: 2,
    pollFailureCount: 2,
    nextPollDelayMs: 5000,
    lastRecoveredAt: null,
  });
});

test("applyPollSuccessState clears stored poll error without changing version", () => {
  const failed = {
    pollError: "network down",
    pollErrorVersion: 2,
    pollFailureCount: 3,
    nextPollDelayMs: 30000,
    lastRecoveredAt: null,
  };
  const recoveredAt = new Date("2026-06-24T10:30:00.000Z");

  assert.deepEqual(applyTaskPollSuccess(failed, recoveredAt), {
    pollError: null,
    pollErrorVersion: 2,
    pollFailureCount: 0,
    nextPollDelayMs: 2000,
    lastRecoveredAt: "2026-06-24T10:30:00.000Z",
  });
  assert.equal(applyTaskPollSuccess(healthyPollState), healthyPollState);
});

test("getTaskPollDelayMs clamps to the configured backoff range", () => {
  assert.equal(getTaskPollDelayMs(-1), 2000);
  assert.equal(getTaskPollDelayMs(0), 2000);
  assert.equal(getTaskPollDelayMs(1), 2000);
  assert.equal(getTaskPollDelayMs(2), 5000);
  assert.equal(getTaskPollDelayMs(3), 10000);
  assert.equal(getTaskPollDelayMs(99), 30000);
});

test("getTaskPollScheduleDelayMs slows idle off-route polling", () => {
  assert.equal(
    getTaskPollScheduleDelayMs({
      baseDelayMs: 2000,
      hasRunningTask: false,
      isDocumentVisible: true,
      isTaskRoute: false,
    }),
    15000,
  );
  assert.equal(
    getTaskPollScheduleDelayMs({
      baseDelayMs: 2000,
      hasRunningTask: true,
      isDocumentVisible: true,
      isTaskRoute: false,
    }),
    2000,
  );
  assert.equal(
    getTaskPollScheduleDelayMs({
      baseDelayMs: 2000,
      hasRunningTask: true,
      isDocumentVisible: false,
      isTaskRoute: true,
    }),
    30000,
  );
});
